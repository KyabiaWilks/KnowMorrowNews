import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const SOURCE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'lucentine-snapshot-2026-08-08.csv');

export const MAJOR_CONFLICT_AD_ID = 'ad_major_conflict_refugee_haven';

export const normalizeDiscordName = (value) => String(value || '').trim().replace(/^@/, '').toLowerCase();

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function loadLucentineAudience() {
  const rows = parseCsv(fs.readFileSync(SOURCE_FILE, 'utf8'));
  const headers = rows.shift().map((value) => value.trim());
  const at = (row, name) => String(row[headers.indexOf(name)] || '').trim();
  const byDiscordName = new Map();
  for (const row of rows) {
    const discordName = at(row, 'Discord Name');
    const discordNameKey = normalizeDiscordName(discordName);
    if (!discordNameKey) continue;
    const record = {
      id: `aud_lucentine_${String(byDiscordName.size + 1).padStart(4, '0')}`,
      source: 'Lucentine Snapshot 8/8',
      sourcePublishedAt: '2026-08-08',
      minecraftIgn: at(row, 'Minecraft IGN') || null,
      discordName,
      discordNameKey,
      island: at(row, 'Island') || null,
      nation: at(row, 'Nation') || null,
      pvp: at(row, 'PVP') || null,
      cohortParty: at(row, 'Cohort/Party') || null,
      userId: null,
      discordId: null,
      linkedAt: null,
    };
    const existing = byDiscordName.get(discordNameKey);
    if (!existing) byDiscordName.set(discordNameKey, record);
    else {
      for (const key of ['minecraftIgn', 'island', 'nation', 'pvp', 'cohortParty']) {
        if (!existing[key] && record[key]) existing[key] = record[key];
      }
    }
  }
  return [...byDiscordName.values()];
}

export function syncAudienceDataset(state) {
  const imported = loadLucentineAudience();
  const previous = new Map((state.audienceMembers || []).map((item) => [item.discordNameKey, item]));
  state.audienceMembers = imported.map((item) => {
    const old = previous.get(item.discordNameKey);
    return old ? { ...item, userId: old.userId || null, discordId: old.discordId || null, linkedAt: old.linkedAt || null } : item;
  });
  for (const user of state.users || []) linkAudienceToUser(state, user);
}

export function ensureMajorConflictAdvertisement(state) {
  state.advertisements ||= [];
  const existing = state.advertisements.find((item) => item.id === MAJOR_CONFLICT_AD_ID);
  const definition = {
    id: MAJOR_CONFLICT_AD_ID,
    kind: 'opening_alert',
    title: 'WARNING',
    body: '# Major Conflict Breaks Out\n\n## Third Island: A Safe Haven for Refugees\n\nSafety is available here.\n\n**Coordinates:** 0, 200\n\nhttps://discord.gg/bRnxFyWGbX',
    imageUrl: null,
    href: 'https://discord.gg/bRnxFyWGbX',
    placement: 'all',
    includedIslands: ['Cold Island'],
    excludedIslands: [],
    excludedNations: ['Lucentine'],
    startsAt: null,
    endsAt: null,
    createdBy: 'system',
  };
  if (!existing) {
    state.advertisements.unshift({ ...definition, active: false, createdAt: new Date().toISOString() });
    return true;
  }
  const before = JSON.stringify(existing);
  Object.assign(existing, definition);
  return JSON.stringify(existing) !== before;
}

export function linkAudienceToUser(state, user) {
  const keys = new Set([normalizeDiscordName(user.discordUsername), normalizeDiscordName(user.username)].filter(Boolean));
  if (!keys.size || !user.discordId) return [];
  const matched = (state.audienceMembers || []).filter((item) => keys.has(item.discordNameKey));
  for (const item of matched) {
    item.userId = user.id;
    item.discordId = user.discordId;
    item.linkedAt ||= new Date().toISOString();
  }
  return matched;
}

export function audienceForUser(state, user) {
  if (!user) return [];
  return (state.audienceMembers || []).filter((item) => item.userId === user.id || (user.discordId && item.discordId === user.discordId));
}

export function adVisibleToUser(state, ad, user, at = new Date()) {
  if (!ad.active) return false;
  if (ad.startsAt && new Date(ad.startsAt) > at) return false;
  if (ad.endsAt && new Date(ad.endsAt) < at) return false;
  const viewerNames = [user?.discordUsername, user?.username].map(normalizeDiscordName).filter(Boolean);
  if (viewerNames.some((name) => config.adDebugDiscordUsernames.includes(name))) return true;
  const includedIslands = new Set((ad.includedIslands || []).map((value) => value.toLowerCase()));
  const excludedIslands = new Set((ad.excludedIslands || []).map((value) => value.toLowerCase()));
  const excludedNations = new Set((ad.excludedNations || []).map((value) => value.toLowerCase()));
  if (!includedIslands.size && !excludedIslands.size && !excludedNations.size) return true;
  const memberships = audienceForUser(state, user);
  if (!memberships.length) return false;
  return memberships.some((item) => {
    const island = String(item.island || '').toLowerCase();
    const nation = String(item.nation || '').toLowerCase();
    return (!includedIslands.size || includedIslands.has(island)) && !excludedIslands.has(island) && !excludedNations.has(nation);
  });
}
