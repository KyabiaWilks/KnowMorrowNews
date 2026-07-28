import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { closeDatabase, isEmpty } from './db.js';
import { attachUser, enforceReadOnly } from './auth.js';
import { seedDatabase } from './seed.js';
import { authRouter } from './routes/auth.routes.js';
import { newsRouter } from './routes/news.routes.js';
import { journalistsRouter } from './routes/journalists.routes.js';
import { tavernRouter } from './routes/tavern.routes.js';
import { tomatoRouter } from './routes/tomato.routes.js';
import { walletRouter } from './routes/wallet.routes.js';
import { uploadRouter } from './routes/upload.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { ghostRouter } from './routes/ghost.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';

if (isEmpty()) {
  console.log('[jontop] 数据库为空，正在写入初始内容…');
  seedDatabase();
}

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: [config.clientOrigin, 'http://127.0.0.1:5173'], credentials: false }));
app.use(express.json({ limit: '2mb' }));
app.use('/files', express.static(config.uploadDir, { maxAge: '1h' }));
app.use(attachUser);
app.use(enforceReadOnly);

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'jontop', time: new Date().toISOString() }));
app.get('/api/config', (_req, res) => res.json({ tomatoPrice: config.tomatoPrice, currency: 'TMT' }));

app.use('/api/auth', authRouter);
app.use('/api/news', newsRouter);
app.use('/api/journalists', journalistsRouter);
app.use('/api/tavern', tavernRouter);
app.use('/api/tomatoes', tomatoRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ghost', ghostRouter);
app.use('/api/notifications', notificationsRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not Found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[jontop]', err);
  res.status(status).json({ error: err.message || '服务器开小差了', ...(err.extra || {}) });
});

const server = app.listen(config.port, () => {
  console.log(`\n  🌙 JONTOP server  →  http://localhost:${config.port}`);
  console.log(`  🍅 一颗番茄 = ${config.tomatoPrice} TMT`);
});

async function shutdown(signal) {
  console.log(`[jontop] ${signal} received; saving data before shutdown.`);
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
