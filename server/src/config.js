import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');

// 极简 .env 读取，避免额外依赖
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export const config = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  authSecret: process.env.AUTH_SECRET || 'jontop-dev-secret',
  ghostKey: process.env.GHOST_KEY || '',
  tomatoPrice: Number(process.env.TOMATO_PRICE || 1),
  databaseUrl: process.env.DATABASE_URL || '',
  dataDir: path.join(ROOT, 'data'),
  dataFile: path.join(ROOT, 'data', 'db.json'),
  uploadDir: path.join(ROOT, 'uploads'),
  discordClientId: process.env.DISCORD_CLIENT_ID || '',
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  discordRedirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:4000/api/auth/discord/callback',
  discordBotToken: process.env.DISCORD_BOT_TOKEN || '',
  discordGuildId: process.env.DISCORD_GUILD_ID || '1528707402319532214',
  supremeDiscordUsername: process.env.SUPREME_DISCORD_USERNAME || 'wisthiulmdar_20786',
};

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });
