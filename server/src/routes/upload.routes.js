import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { db, save } from '../db.js';
import { requireAuth } from '../auth.js';
import { HttpError, bad, now, uid, wrap } from '../util.js';
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
    if (userOfProfile(submission.profileId)?.id === user.id) return true;
    if (submission.status === 'accepted' && request && userOfProfile(request.profileId)?.id === user.id) return true;
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
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'");
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
  fileFilter: (_req, file, cb) => {
    const allowed = new Map([
      ['.jpg', ['image/jpeg']], ['.jpeg', ['image/jpeg']], ['.png', ['image/png']],
      ['.webp', ['image/webp']], ['.gif', ['image/gif']], ['.avif', ['image/avif']],
      ['.mp4', ['video/mp4']], ['.webm', ['video/webm']],
      ['.pdf', ['application/pdf']], ['.txt', ['text/plain']],
    ]);
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.get(ext)?.includes(file.mimetype.toLowerCase())) {
      return cb(new HttpError(400, 'Unsupported or unsafe file type. Upload JPG, PNG, WebP, GIF, AVIF, MP4, WebM, PDF, or TXT files only.'));
    }
    cb(null, true);
  },
});

function signatureMatches(file) {
  const bytes = fs.readFileSync(file.path);
  const ascii = (start, end) => bytes.subarray(start, end).toString('ascii');
  if (file.mimetype === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === 'image/webp') return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  if (file.mimetype === 'image/gif') return ['GIF87a', 'GIF89a'].includes(ascii(0, 6));
  if (file.mimetype === 'image/avif') return ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12));
  if (file.mimetype === 'video/mp4') return ascii(4, 8) === 'ftyp';
  if (file.mimetype === 'video/webm') return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (file.mimetype === 'application/pdf') return ascii(0, 5) === '%PDF-';
  if (file.mimetype === 'text/plain') {
    if (bytes.includes(0)) return false;
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return true; } catch { return false; }
  }
  return false;
}

/** 证据文件。文件名被随机化，URL 不可枚举，只有解锁者拿得到。 */
uploadRouter.post(
  '/evidence',
  requireAuth,
  upload.array('files', 6),
  wrap((req, res) => {
    const invalid = (req.files || []).find((file) => !signatureMatches(file));
    if (invalid) {
      for (const file of req.files || []) fs.rmSync(file.path, { force: true });
      throw bad(`“${invalid.originalname}” does not match its declared file type and was rejected.`);
    }
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

uploadRouter.post(
  '/evidence/youtube',
  requireAuth,
  wrap((req, res) => {
    const rawUrl = String(req.body.url || '').trim();
    let parsed;
    try { parsed = new URL(rawUrl); } catch { throw bad('Enter a valid YouTube URL.'); }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let videoId = '';
    if (host === 'youtu.be') videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (['youtube.com', 'm.youtube.com'].includes(host)) {
      videoId = parsed.pathname === '/watch'
        ? parsed.searchParams.get('v') || ''
        : (/^\/(?:shorts|embed)\/([^/]+)/.exec(parsed.pathname)?.[1] || '');
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw bad('Only valid youtube.com or youtu.be video links are supported.');
    const item = {
      id: uid('evd'),
      uploaderId: req.user.id,
      name: `YouTube video ${videoId}`,
      stored: null,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      videoProvider: 'youtube',
      videoId,
      mime: 'video/youtube',
      size: 0,
      createdAt: now(),
    };
    db.evidence.push(item);
    save();
    res.json({ file: { id: item.id, name: item.name, url: item.sourceUrl, mime: item.mime, size: 0, sourceUrl: item.sourceUrl, videoProvider: item.videoProvider, videoId } });
  })
);
