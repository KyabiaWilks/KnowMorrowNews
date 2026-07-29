import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { db, save } from '../db.js';
import { requireAuth } from '../auth.js';
import { now, uid, wrap } from '../util.js';
import { hasUnlocked, userOfProfile } from '../services.js';

export const uploadRouter = Router();

function canAccessEvidence(user, evidence) {
  if (evidence.uploaderId === user.id) return true;
  if (['read_only_admin', 'event_staff'].includes(user.siteRole)) return true;

  for (const offer of db.offers) {
    const tier = offer.tiers.find((item) => (item.evidenceIds || []).includes(evidence.id));
    if (!tier) continue;
    if (userOfProfile(offer.profileId)?.id === user.id || hasUnlocked(user.id, offer.id, tier.id)) return true;
  }

  for (const submission of db.submissions) {
    if (!(submission.evidenceIds || []).includes(evidence.id)) continue;
    const request = db.requests.find((item) => item.id === submission.requestId);
    if (userOfProfile(submission.profileId)?.id === user.id || (request && userOfProfile(request.profileId)?.id === user.id)) return true;
  }

  const linkedReport = db.reports.some((report) => (report.evidenceIds || []).includes(evidence.id));
  if (linkedReport && (['admin', 'superadmin'].includes(user.siteRole) || user.role === 'admin')) return true;
  return db.reports.some((report) => report.reporterUserId === user.id && (report.evidenceIds || []).includes(evidence.id));
}

uploadRouter.get(
  '/evidence/:id',
  requireAuth,
  wrap((req, res) => {
    const evidence = db.evidence.find((item) => item.id === req.params.id);
    if (!evidence || !canAccessEvidence(req.user, evidence)) return res.status(404).json({ error: 'Evidence file not found.' });
    const filename = encodeURIComponent(String(evidence.name || 'evidence').replace(/[\r\n"]/g, '_'));
    res.setHeader('Content-Type', evidence.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="evidence"; filename*=UTF-8''${filename}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(path.resolve(config.uploadDir, evidence.stored));
  })
);

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
      return { id: item.id, name: item.name, url: `/api/upload/evidence/${item.id}`, mime: item.mime, size: item.size };
    });
    save();
    res.json({ files: created });
  })
);
