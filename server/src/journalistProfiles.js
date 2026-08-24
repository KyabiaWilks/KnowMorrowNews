const DIRECTORY_IDENTITIES = {
  jnl_daffodiljunior: { ign: 'DaffodilJunior', discordUsername: 'daffodiljunior' },
  jnl_enigma: { ign: 'StillanEnigma' },
  jnl_chocolate_uvu: { ign: 'chocolate_UVU' },
  jnl_scarhebs: { ign: 'Scarhebs' },
  jnl_dd3182: { ign: 'DD3182' },
  jnl_pumpkin: { ign: 'Pumpkinpaii6183' },
  jnl_yanyegg: { ign: 'Yan_YEgg' },
  jnl_noisymoon: { ign: 'NoisyMoon0207' },
  jnl_alpha: { ign: 'AgentAlphakill', discordUsername: 'alphatier' },
  jnl_kyabia: { ign: 'Kyabia162' },
  jnl_undipin: { ign: 'undipin' },
  jnl_lunarian: { ign: 'luna_rian' },
  jnl_raysong: { ign: 'Rayne_Song' },
};

export const minecraftAvatar = (journalist) => journalist?.ign
  ? `https://mc-heads.net/avatar/${encodeURIComponent(journalist.ign)}/128`
  : null;

export function ensureJournalistProfile(state, user) {
  if (!user) return null;
  const existing = state.journalists.find((item) => item.userId === user.id);
  if (existing) return existing;
  const discordUsername = String(user.discordUsername || user.username || '').toLowerCase();
  if (discordUsername === 'thegunrat') {
    const gunratProfile = state.journalists.find((item) => item.id === 'jnl_thegunrat');
    if (gunratProfile) {
      gunratProfile.userId = user.id;
      return gunratProfile;
    }
  }
  const reserved = state.journalists.find((item) => !item.userId && item.discordUsername?.toLowerCase() === discordUsername);
  if (reserved) {
    reserved.userId = user.id;
    if (user.siteRole === 'user') {
      user.siteRole = 'journalist';
      user.role = 'user';
    }
    return reserved;
  }
  if (user.siteRole !== 'journalist') return null;
  const journalist = {
    id: `jnl_${user.id.replace(/^usr_/, '')}`,
    userId: user.id,
    name: user.displayName || user.username || 'New reporter',
    title: 'Staff Reporter',
    avatar: user.discordAvatar || null,
    portraitTone: '#2f6bff',
    tagline: 'Every detail has a witness.',
    bio: 'This reporter joined Know Morrow through the Tomato press corps.',
    beats: ['General Assignment'],
    awards: [],
    milestones: [{ year: new Date().getFullYear(), text: 'Joined the Know Morrow press corps' }],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: new Date().toISOString(),
  };
  state.journalists.push(journalist);
  return journalist;
}

export function syncJournalistProfiles(state) {
  let changed = false;
  const gunratUser = (state.users || []).find((user) => user.username?.toLowerCase() === 'thegunrat');
  let gunratProfile = (state.journalists || []).find((journalist) => journalist.id === 'jnl_thegunrat');
  if (!gunratProfile) {
    gunratProfile = {
      id: 'jnl_thegunrat',
      userId: gunratUser?.id || null,
      name: 'TheGunRat',
      title: 'Columnist',
      avatar: gunratUser?.discordAvatar || '/contributors/thegunrat.jpg',
      portraitTone: '#70513b',
      tagline: 'Stories from wherever things get unexpectedly dramatic.',
      bio: 'TheGunRat writes dispatches, observations, and highly eventful accounts for Know Morrow News.',
      beats: ['Writer'],
      awards: [],
      milestones: [{ year: 2026, text: 'Began TheGunRat Quotes at Know Morrow News' }],
      signatureWorks: [],
      contact: null,
      featured: false,
      hidden: false,
      joinedAt: new Date().toISOString(),
    };
    state.journalists.push(gunratProfile);
    changed = true;
  } else if (gunratUser && gunratProfile.userId !== gunratUser.id) {
    gunratProfile.userId = gunratUser.id;
    changed = true;
  }
  for (const journalist of state.journalists || []) {
    const identity = DIRECTORY_IDENTITIES[journalist.id];
    if (!identity) continue;
    for (const [key, value] of Object.entries(identity)) {
      if (journalist[key] === value) continue;
      journalist[key] = value;
      changed = true;
    }
  }
  for (const user of state.users || []) {
    const before = state.journalists.find((item) => item.userId === user.id);
    const profile = ensureJournalistProfile(state, user);
    if (profile && !before) changed = true;
  }
  return changed;
}
