import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';

import { prisma } from './prisma.js';
import { authTelegram, requireAuth, attachUser, requireAdmin, sanitizeUser } from './auth.js';
import { addDays, isAccessActive, now } from './utils.js';
import { createYooKassaPayment, getYooKassaPayment } from './yookassa.js';
import { uploadToS3, deleteFromS3, getSignedStreamUrl } from './storage.js';

const router = express.Router();

// ─── Auth ────────────────────────────────────────────────────────────────────

router.post('/auth/telegram', authTelegram);

// ─── Me ──────────────────────────────────────────────────────────────────────

router.get('/me', requireAuth, attachUser, async (req, res) => {
  res.json({ ok: true, user: sanitizeUser(req.user), accessActive: isAccessActive(req.user) });
});

router.post('/me/trial/start', requireAuth, attachUser, async (req, res) => {
  const trialDays = Number(process.env.TRIAL_DAYS || 7);
  if (req.user.trialStartedAt) {
    return res.json({ ok: true, user: sanitizeUser(req.user), accessActive: isAccessActive(req.user), message: 'Trial already started' });
  }
  const trialStartedAt = now();
  const trialEndsAt = addDays(trialStartedAt, trialDays);
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { trialStartedAt, trialEndsAt }
  });
  res.json({ ok: true, user: sanitizeUser(user), accessActive: isAccessActive(user) });
});

// ─── Catalog ─────────────────────────────────────────────────────────────────

router.get('/tracks', requireAuth, attachUser, async (req, res) => {
  const q = String(req.query.search || '').trim();
  const where = {
    isPublished: true,
    ...(q ? { OR: [
      { title: { contains: q, mode: 'insensitive' } },
      { artist: { contains: q, mode: 'insensitive' } }
    ]} : {})
  };
  const tracks = await prisma.track.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  // Generate signed cover URLs for tracks that have a cover S3 key
  const tracksWithCovers = await Promise.all(tracks.map(async (t) => {
    if (t.coverUrl && t.coverUrl.startsWith('covers/')) {
      try {
        t = { ...t, coverUrl: await getSignedStreamUrl(t.coverUrl) };
      } catch { /* keep original */ }
    }
    return t;
  }));
  res.json({ ok: true, tracks: tracksWithCovers });
});

router.get('/tracks/:id', requireAuth, attachUser, async (req, res) => {
  const track = await prisma.track.findFirst({ where: { id: req.params.id, isPublished: true } });
  if (!track) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, track });
});

// ─── Streaming — redirect to signed S3 URL ───────────────────────────────────

router.get('/tracks/:id/stream', requireAuth, attachUser, async (req, res) => {
  const track = await prisma.track.findFirst({ where: { id: req.params.id, isPublished: true } });
  if (!track || !track.filePath) return res.status(404).json({ ok: false, error: 'Track/file not found' });

  if (!isAccessActive(req.user)) {
    return res.status(402).json({ ok: false, error: 'Subscription or trial required' });
  }

  try {
    const signedUrl = await getSignedStreamUrl(track.filePath);
    // Redirect to signed URL — browser/fetch will follow it
    res.redirect(302, signedUrl);
  } catch (e) {
    console.error('Stream error:', e);
    res.status(500).json({ ok: false, error: 'Failed to generate stream URL' });
  }
});

// ─── Favorites ───────────────────────────────────────────────────────────────

router.get('/me/favorites', requireAuth, attachUser, async (req, res) => {
  const favs = await prisma.favorite.findMany({
    where: { userId: req.user.id },
    include: { track: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ ok: true, favorites: favs.map(f => f.track).filter(t => t.isPublished) });
});

router.post('/me/favorites/:trackId', requireAuth, attachUser, async (req, res) => {
  const trackId = req.params.trackId;
  const track = await prisma.track.findFirst({ where: { id: trackId, isPublished: true } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });
  await prisma.favorite.upsert({
    where: { userId_trackId: { userId: req.user.id, trackId } },
    update: {},
    create: { userId: req.user.id, trackId }
  });
  res.json({ ok: true });
});

router.delete('/me/favorites/:trackId', requireAuth, attachUser, async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: req.user.id, trackId: req.params.trackId } });
  res.json({ ok: true });
});

// ─── Billing: YooKassa ───────────────────────────────────────────────────────

router.post('/billing/yookassa/create-payment', requireAuth, attachUser, async (req, res) => {
  const planDays = Number(process.env.PLAN_BASIC_DAYS || 30);
  const amountRub = String(process.env.PLAN_BASIC_AMOUNT_RUB || '199.00');
  const returnUrl = `${process.env.FRONTEND_URL}/#/billing/return`;
  const ykPayment = await createYooKassaPayment({
    amountRub, returnUrl,
    description: `Подписка на ${planDays} дней`,
    metadata: { userId: req.user.id, planDays: String(planDays) }
  });
  await prisma.payment.create({
    data: {
      userId: req.user.id,
      providerPaymentId: ykPayment.id,
      status: ykPayment.status,
      amountRub, planDays
    }
  });
  res.json({ ok: true, confirmationUrl: ykPayment.confirmation?.confirmation_url, paymentId: ykPayment.id });
});

router.post('/billing/yookassa/webhook', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const event = req.body?.event;
    const obj = req.body?.object;
    const paymentId = obj?.id;
    if (!event || !paymentId) return res.sendStatus(200);
    const fresh = await getYooKassaPayment(paymentId);
    await prisma.payment.updateMany({
      where: { providerPaymentId: paymentId },
      data: { status: fresh.status || String(obj?.status || 'unknown') }
    });
    if (event === 'payment.succeeded' && fresh.status === 'succeeded') {
      const userId = fresh.metadata?.userId;
      const planDays = Number(fresh.metadata?.planDays || process.env.PLAN_BASIC_DAYS || 30);
      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          const base = (user.accessEndsAt && user.accessEndsAt > now()) ? user.accessEndsAt : now();
          await prisma.user.update({ where: { id: userId }, data: { accessEndsAt: addDays(base, planDays) } });
        }
      }
    }
  } catch (e) {
    console.error('Webhook error:', e);
  }
  return res.sendStatus(200);
});

// ─── Admin: Tracks ───────────────────────────────────────────────────────────

// multer stores files in OS temp dir, we upload to S3 then delete locally
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 50) * 1024 * 1024 }
});

const coverUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

router.get('/admin/tracks', requireAuth, requireAdmin, async (req, res) => {
  const rawTracks = await prisma.track.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  const tracks = await Promise.all(rawTracks.map(async (t) => {
    if (t.coverUrl && t.coverUrl.startsWith('covers/')) {
      try {
        t = { ...t, coverUrl: await getSignedStreamUrl(t.coverUrl) };
      } catch { /* keep original */ }
    }
    return t;
  }));
  res.json({ ok: true, tracks });
});

router.post('/admin/tracks', requireAuth, requireAdmin, async (req, res) => {
  const { title, artist } = req.body || {};
  if (!title) return res.status(400).json({ ok: false, error: 'title required' });
  const track = await prisma.track.create({
    data: { title: String(title), artist: artist ? String(artist) : null, isPublished: false }
  });
  res.json({ ok: true, track });
});

router.post('/admin/tracks/:id/upload', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  const trackId = req.params.id;
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });
  if (!req.file) return res.status(400).json({ ok: false, error: 'file required' });

  // Delete old audio from S3 if exists
  if (track.filePath) await deleteFromS3(track.filePath);

  const ext = path.extname(req.file.originalname || '') || '.mp3';
  const s3Key = `audio/${trackId}${ext}`;
  await uploadToS3(req.file.path, s3Key, req.file.mimetype || 'audio/mpeg');

  const updated = await prisma.track.update({
    where: { id: trackId },
    data: { filePath: s3Key }
  });
  res.json({ ok: true, track: updated });
});

router.post('/admin/tracks/:id/cover', requireAuth, requireAdmin, coverUpload.single('cover'), async (req, res) => {
  const trackId = req.params.id;
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });
  if (!req.file) return res.status(400).json({ ok: false, error: 'cover image required' });

  // Delete old cover from S3 if exists
  if (track.coverUrl && track.coverUrl.startsWith('covers/')) await deleteFromS3(track.coverUrl);

  const ext = path.extname(req.file.originalname || '') || '.jpg';
  const s3Key = `covers/${trackId}_cover${ext}`;
  await uploadToS3(req.file.path, s3Key, req.file.mimetype || 'image/jpeg');

  // Save S3 key, not a public URL — signed URL generated at query time
  const updated = await prisma.track.update({
    where: { id: trackId },
    data: { coverUrl: s3Key }
  });
  res.json({ ok: true, track: updated });
});

router.post('/admin/tracks/:id/publish', requireAuth, requireAdmin, async (req, res) => {
  const trackId = req.params.id;
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });
  if (!track.filePath) return res.status(400).json({ ok: false, error: 'Upload audio file first' });

  const updated = await prisma.track.update({
    where: { id: trackId },
    data: { isPublished: true }
  });
  res.json({ ok: true, track: updated });
});

export default router;
