import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { prisma } from './prisma.js';
import { authTelegram, requireAuth, attachUser, requireAdmin, sanitizeUser } from './auth.js';
import { addDays, isAccessActive, now } from './utils.js';
import { createYooKassaPayment, getYooKassaPayment } from './yookassa.js';

const router = express.Router();

// --------- Auth ---------
router.post('/auth/telegram', authTelegram);

// --------- Me ---------
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

// --------- Catalog ---------
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
  res.json({ ok: true, tracks });
});

router.get('/tracks/:id', requireAuth, attachUser, async (req, res) => {
  const track = await prisma.track.findFirst({ where: { id: req.params.id, isPublished: true } });
  if (!track) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, track });
});

// --------- Streaming (dev: local file) ---------
router.get('/tracks/:id/stream', requireAuth, attachUser, async (req, res) => {
  const track = await prisma.track.findFirst({ where: { id: req.params.id, isPublished: true } });
  if (!track || !track.filePath) return res.status(404).json({ ok: false, error: 'Track/file not found' });

  if (!isAccessActive(req.user)) {
    return res.status(402).json({ ok: false, error: 'Subscription or trial required' });
  }

  const filePath = path.resolve(track.filePath);
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'File missing on server' });

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = String(range).replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'audio/mpeg'
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'audio/mpeg'
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// --------- Favorites ---------
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
  const trackId = req.params.trackId;
  await prisma.favorite.deleteMany({ where: { userId: req.user.id, trackId } });
  res.json({ ok: true });
});

// --------- Billing: YooKassa ---------
router.post('/billing/yookassa/create-payment', requireAuth, attachUser, async (req, res) => {
  const planDays = Number(process.env.PLAN_BASIC_DAYS || 30);
  const amountRub = String(process.env.PLAN_BASIC_AMOUNT_RUB || '199.00');

  const returnUrl = `${process.env.FRONTEND_URL}/#/billing/return`;
  const ykPayment = await createYooKassaPayment({
    amountRub,
    returnUrl,
    description: `Подписка на ${planDays} дней`,
    metadata: { userId: req.user.id, planDays: String(planDays) }
  });

  await prisma.payment.create({
    data: {
      userId: req.user.id,
      providerPaymentId: ykPayment.id,
      status: ykPayment.status,
      amountRub,
      planDays
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

    // Verify by fetching payment from YooKassa API (defensive)
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
          const newEndsAt = addDays(base, planDays);
          await prisma.user.update({ where: { id: userId }, data: { accessEndsAt: newEndsAt } });
        }
      }
    }
  } catch (e) {
    console.error('Webhook error:', e);
  }
  return res.sendStatus(200);
});

// --------- Admin: Tracks ---------
const uploadDir = process.env.UPLOAD_DIR || './uploads';
fs.mkdirSync(uploadDir, { recursive: true });
const maxMb = Number(process.env.MAX_UPLOAD_MB || 50);

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: maxMb * 1024 * 1024 }
});

router.get('/admin/tracks', requireAuth, requireAdmin, async (req, res) => {
  const tracks = await prisma.track.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
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

  const ext = path.extname(req.file.originalname || '') || '.mp3';
  const newPath = path.join(uploadDir, `${trackId}${ext}`);
  fs.renameSync(req.file.path, newPath);

  const updated = await prisma.track.update({
    where: { id: trackId },
    data: { filePath: newPath }
  });

  res.json({ ok: true, track: updated });
});

router.post('/admin/tracks/:id/publish', requireAuth, requireAdmin, async (req, res) => {
  const trackId = req.params.id;
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });
  if (!track.filePath) return res.status(400).json({ ok: false, error: 'Upload file first' });

  const updated = await prisma.track.update({
    where: { id: trackId },
    data: { isPublished: true }
  });

  res.json({ ok: true, track: updated });
});

const coverUploadDir = process.env.COVER_DIR || './uploads/covers';
fs.mkdirSync(coverUploadDir, { recursive: true });

const coverUpload = multer({
  dest: coverUploadDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

router.post('/admin/tracks/:id/cover', requireAuth, requireAdmin, coverUpload.single('cover'), async (req, res) => {
  const trackId = req.params.id;
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });
  if (!req.file) return res.status(400).json({ ok: false, error: 'cover image required' });

  // Delete old cover file if exists and is local
  if (track.coverUrl && !track.coverUrl.startsWith('http')) {
    const oldPath = path.resolve('.' + track.coverUrl.replace(/^\/covers\//, '/uploads/covers/'));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const ext = path.extname(req.file.originalname || '') || '.jpg';
  const filename = `${trackId}_cover${ext}`;
  const newPath = path.join(coverUploadDir, filename);
  fs.renameSync(req.file.path, newPath);

  // Store as URL path served statically
  const coverUrl = `/covers/${filename}`;

  const updated = await prisma.track.update({
    where: { id: trackId },
    data: { coverUrl }
  });

  res.json({ ok: true, track: updated });
});

export default router;
