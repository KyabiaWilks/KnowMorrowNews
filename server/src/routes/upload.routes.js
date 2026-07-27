import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { db, save } from '../db.js';
import { requireAuth } from '../auth.js';
import { now, uid, wrap } from '../util.js';

export const uploadRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12).replace(/[^\w.]/g, '');
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 6 },
});

/** 证据文件。文件名被随机化，URL 不可枚举，只有解锁者拿得到。 */
uploadRouter.post(
  '/evidence',
  requireAuth,
  upload.array('files', 6),
  wrap((req, res) => {
    const created = (req.files || []).map((f) => {
      const item = {
        id: uid('evd'),
        uploaderId: req.user.id,
        name: Buffer.from(f.originalname, 'latin1').toString('utf8').slice(0, 80),
        stored: f.filename,
        url: `/files/${f.filename}`,
        mime: f.mimetype,
        size: f.size,
        createdAt: now(),
      };
      db.evidence.push(item);
      return { id: item.id, name: item.name, url: item.url, mime: item.mime, size: item.size };
    });
    save();
    res.json({ files: created });
  })
);
