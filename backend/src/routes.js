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

// ── helpers ───────────────────────────────────────────────────────────────────

async function signCovers(tracks) {
  return Promise.all(tracks.map(async (t) => {
    if (t.coverUrl && t.coverUrl.startsWith('covers/')) {
      try { t = { ...t, coverUrl: await getSignedStreamUrl(t.coverUrl) }; } catch {}
    }
    return t;
  }));
}

// ── Auth ──────────────────────────────────────────────────────────────────────

router.post('/auth/telegram', authTelegram);

// ── Me ────────────────────────────────────────────────────────────────────────

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
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { trialStartedAt, trialEndsAt } });
  res.json({ ok: true, user: sanitizeUser(user), accessActive: isAccessActive(user) });
});

// ── Catalog ───────────────────────────────────────────────────────────────────

router.get('/tracks', requireAuth, attachUser, async (req, res) => {
  const q = String(req.query.search || '').trim();
  const where = {
    isPublished: true,
    ...(q ? { OR: [
      { title: { contains: q, mode: 'insensitive' } },
      { artist: { contains: q, mode: 'insensitive' } }
    ]} : {})
  };
  const tracks = await prisma.track.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ ok: true, tracks: await signCovers(tracks) });
});

router.get('/tracks/:id', requireAuth, attachUser, async (req, res) => {
  const track = await prisma.track.findFirst({ where: { id: req.params.id, isPublished: true } });
  if (!track) return res.status(404).json({ ok: false, error: 'Not found' });
  const [signed] = await signCovers([track]);
  res.json({ ok: true, track: signed });
});

// ── Streaming ─────────────────────────────────────────────────────────────────

router.get('/tracks/:id/stream', requireAuth, attachUser, async (req, res) => {
  const track = await prisma.track.findFirst({ where: { id: req.params.id, isPublished: true } });
  if (!track || !track.filePath) return res.status(404).json({ ok: false, error: 'Track/file not found' });
  if (!isAccessActive(req.user)) return res.status(402).json({ ok: false, error: 'Subscription or trial required' });

  try {
    const signedUrl = await getSignedStreamUrl(track.filePath);
    res.redirect(302, signedUrl);
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to generate stream URL' });
  }
});

// Record listen — called by frontend when track starts playing
router.post('/tracks/:id/listen', requireAuth, attachUser, async (req, res) => {
  const trackId = req.params.id;
  const track = await prisma.track.findFirst({ where: { id: trackId, isPublished: true } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });

  await prisma.$transaction([
    prisma.listenHistory.create({ data: { userId: req.user.id, trackId } }),
    prisma.track.update({ where: { id: trackId }, data: { playCount: { increment: 1 } } }),
  ]);

  res.json({ ok: true });
});

// ── Favorites ─────────────────────────────────────────────────────────────────

router.get('/me/favorites', requireAuth, attachUser, async (req, res) => {
  const favs = await prisma.favorite.findMany({
    where: { userId: req.user.id },
    include: { track: true },
    orderBy: { createdAt: 'desc' }
  });
  const tracks = favs.map(f => f.track).filter(t => t.isPublished);
  res.json({ ok: true, favorites: await signCovers(tracks) });
});

router.post('/me/favorites/:trackId', requireAuth, attachUser, async (req, res) => {
  const trackId = req.params.trackId;
  const track = await prisma.track.findFirst({ where: { id: trackId, isPublished: true } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });
  await prisma.favorite.upsert({
    where: { userId_trackId: { userId: req.user.id, trackId } },
    update: {}, create: { userId: req.user.id, trackId }
  });
  res.json({ ok: true });
});

router.delete('/me/favorites/:trackId', requireAuth, attachUser, async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: req.user.id, trackId: req.params.trackId } });
  res.json({ ok: true });
});

// ── Listen History ────────────────────────────────────────────────────────────

// Recent listens (last 50, deduplicated by track, most recent first)
router.get('/me/history', requireAuth, attachUser, async (req, res) => {
  const rows = await prisma.listenHistory.findMany({
    where: { userId: req.user.id },
    include: { track: true },
    orderBy: { listenedAt: 'desc' },
    take: 200,
  });

  // Deduplicate: keep first occurrence of each track (most recent listen)
  const seen = new Set();
  const unique = [];
  for (const r of rows) {
    if (!seen.has(r.trackId) && r.track.isPublished) {
      seen.add(r.trackId);
      unique.push({ ...r.track, listenedAt: r.listenedAt });
    }
    if (unique.length >= 50) break;
  }
  res.json({ ok: true, history: await signCovers(unique) });
});

// Top tracks by play count
router.get('/me/top-tracks', requireAuth, attachUser, async (req, res) => {
  // Count per track for this user
  const counts = await prisma.listenHistory.groupBy({
    by: ['trackId'],
    where: { userId: req.user.id },
    _count: { trackId: true },
    orderBy: { _count: { trackId: 'desc' } },
    take: 20,
  });

  const trackIds = counts.map(c => c.trackId);
  const tracks = await prisma.track.findMany({ where: { id: { in: trackIds }, isPublished: true } });
  const trackMap = Object.fromEntries(tracks.map(t => [t.id, t]));

  const result = counts
    .filter(c => trackMap[c.trackId])
    .map(c => ({ ...trackMap[c.trackId], userPlayCount: c._count.trackId }));

  res.json({ ok: true, topTracks: await signCovers(result) });
});

// ── Playlists ─────────────────────────────────────────────────────────────────

router.get('/me/playlists', requireAuth, attachUser, async (req, res) => {
  const playlists = await prisma.playlist.findMany({
    where: { userId: req.user.id },
    include: {
      playlistTracks: {
        include: { track: true },
        orderBy: { position: 'asc' },
        take: 1, // just first track for cover preview
      },
      _count: { select: { playlistTracks: true } }
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ ok: true, playlists });
});

router.post('/me/playlists', requireAuth, attachUser, async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, error: 'name required' });
  const playlist = await prisma.playlist.create({
    data: { userId: req.user.id, name: String(name) }
  });
  res.json({ ok: true, playlist });
});

router.get('/me/playlists/:id', requireAuth, attachUser, async (req, res) => {
  const playlist = await prisma.playlist.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: {
      playlistTracks: { include: { track: true }, orderBy: { position: 'asc' } }
    }
  });
  if (!playlist) return res.status(404).json({ ok: false, error: 'Playlist not found' });
  const tracks = playlist.playlistTracks.map(pt => pt.track).filter(t => t.isPublished);
  res.json({ ok: true, playlist: { ...playlist, tracks: await signCovers(tracks) } });
});

router.patch('/me/playlists/:id', requireAuth, attachUser, async (req, res) => {
  const { name } = req.body || {};
  const playlist = await prisma.playlist.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!playlist) return res.status(404).json({ ok: false, error: 'Playlist not found' });
  const updated = await prisma.playlist.update({ where: { id: req.params.id }, data: { name: String(name) } });
  res.json({ ok: true, playlist: updated });
});

router.delete('/me/playlists/:id', requireAuth, attachUser, async (req, res) => {
  const playlist = await prisma.playlist.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!playlist) return res.status(404).json({ ok: false, error: 'Playlist not found' });
  await prisma.playlist.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.post('/me/playlists/:id/tracks', requireAuth, attachUser, async (req, res) => {
  const { trackId } = req.body || {};
  const playlist = await prisma.playlist.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!playlist) return res.status(404).json({ ok: false, error: 'Playlist not found' });
  const track = await prisma.track.findFirst({ where: { id: trackId, isPublished: true } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });

  const maxPos = await prisma.playlistTrack.aggregate({
    where: { playlistId: playlist.id },
    _max: { position: true }
  });
  const position = (maxPos._max.position ?? -1) + 1;

  await prisma.playlistTrack.upsert({
    where: { playlistId_trackId: { playlistId: playlist.id, trackId } },
    update: {},
    create: { playlistId: playlist.id, trackId, position }
  });
  await prisma.playlist.update({ where: { id: playlist.id }, data: { updatedAt: new Date() } });
  res.json({ ok: true });
});

router.delete('/me/playlists/:id/tracks/:trackId', requireAuth, attachUser, async (req, res) => {
  const playlist = await prisma.playlist.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!playlist) return res.status(404).json({ ok: false, error: 'Playlist not found' });
  await prisma.playlistTrack.deleteMany({ where: { playlistId: playlist.id, trackId: req.params.trackId } });
  res.json({ ok: true });
});

// ── Artists ───────────────────────────────────────────────────────────────────

router.get('/artists', requireAuth, attachUser, async (req, res) => {
  const artists = await prisma.artist.findMany({ orderBy: { name: 'asc' } });
  const signed = await Promise.all(artists.map(async (a) => {
    if (a.photoUrl && a.photoUrl.startsWith('artists/')) {
      try { a = { ...a, photoUrl: await getSignedStreamUrl(a.photoUrl) }; } catch {}
    }
    return a;
  }));
  res.json({ ok: true, artists: signed });
});

router.get('/artists/:id', requireAuth, attachUser, async (req, res) => {
  const artist = await prisma.artist.findUnique({ where: { id: req.params.id } });
  if (!artist) return res.status(404).json({ ok: false, error: 'Artist not found' });

  const tracks = await prisma.track.findMany({
    where: { artistId: req.params.id, isPublished: true },
    orderBy: { playCount: 'desc' },
  });

  let a = artist;
  if (a.photoUrl && a.photoUrl.startsWith('artists/')) {
    try { a = { ...a, photoUrl: await getSignedStreamUrl(a.photoUrl) }; } catch {}
  }

  res.json({ ok: true, artist: a, tracks: await signCovers(tracks) });
});

// ── Billing ───────────────────────────────────────────────────────────────────

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
    data: { userId: req.user.id, providerPaymentId: ykPayment.id, status: ykPayment.status, amountRub, planDays }
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
  } catch (e) { console.error('Webhook error:', e); }
  return res.sendStatus(200);
});

// ── Admin: Tracks ─────────────────────────────────────────────────────────────

const upload = multer({ dest: os.tmpdir(), limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 50) * 1024 * 1024 } });
const coverUpload = multer({
  dest: os.tmpdir(), limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images only'))
});

router.get('/admin/tracks', requireAuth, requireAdmin, async (req, res) => {
  const raw = await prisma.track.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ ok: true, tracks: await signCovers(raw) });
});

router.post('/admin/tracks', requireAuth, requireAdmin, async (req, res) => {
  const { title, artist } = req.body || {};
  if (!title) return res.status(400).json({ ok: false, error: 'title required' });
  const track = await prisma.track.create({
    data: { title: String(title), artist: artist ? String(artist) : null, isPublished: false }
  });
  res.json({ ok: true, track });
});

router.patch('/admin/tracks/:id', requireAuth, requireAdmin, async (req, res) => {
  const { title, artist } = req.body || {};
  const track = await prisma.track.findUnique({ where: { id: req.params.id } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });
  const updated = await prisma.track.update({
    where: { id: req.params.id },
    data: {
      ...(title !== undefined ? { title: String(title) } : {}),
      ...(artist !== undefined ? { artist: artist ? String(artist) : null } : {}),
    }
  });
  res.json({ ok: true, track: updated });
});

router.post('/admin/tracks/:id/upload', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  const track = await prisma.track.findUnique({ where: { id: req.params.id } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });
  if (!req.file) return res.status(400).json({ ok: false, error: 'file required' });
  if (track.filePath) await deleteFromS3(track.filePath);
  const ext = path.extname(req.file.originalname || '') || '.mp3';
  const s3Key = `audio/${req.params.id}${ext}`;
  await uploadToS3(req.file.path, s3Key, req.file.mimetype || 'audio/mpeg');
  const updated = await prisma.track.update({ where: { id: req.params.id }, data: { filePath: s3Key } });
  res.json({ ok: true, track: updated });
});

router.post('/admin/tracks/:id/cover', requireAuth, requireAdmin, coverUpload.single('cover'), async (req, res) => {
  const track = await prisma.track.findUnique({ where: { id: req.params.id } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });
  if (!req.file) return res.status(400).json({ ok: false, error: 'cover required' });
  if (track.coverUrl && track.coverUrl.startsWith('covers/')) await deleteFromS3(track.coverUrl);
  const ext = path.extname(req.file.originalname || '') || '.jpg';
  const s3Key = `covers/${req.params.id}_cover${ext}`;
  await uploadToS3(req.file.path, s3Key, req.file.mimetype || 'image/jpeg');
  const updated = await prisma.track.update({ where: { id: req.params.id }, data: { coverUrl: s3Key } });
  res.json({ ok: true, track: updated });
});

router.post('/admin/tracks/:id/publish', requireAuth, requireAdmin, async (req, res) => {
  const track = await prisma.track.findUnique({ where: { id: req.params.id } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });
  if (!track.filePath) return res.status(400).json({ ok: false, error: 'Upload audio first' });
  const updated = await prisma.track.update({ where: { id: req.params.id }, data: { isPublished: true } });
  res.json({ ok: true, track: updated });
});

router.delete('/admin/tracks/:id', requireAuth, requireAdmin, async (req, res) => {
  const track = await prisma.track.findUnique({ where: { id: req.params.id } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });
  if (track.filePath) await deleteFromS3(track.filePath);
  if (track.coverUrl && track.coverUrl.startsWith('covers/')) await deleteFromS3(track.coverUrl);
  await prisma.favorite.deleteMany({ where: { trackId: req.params.id } });
  await prisma.track.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ── Admin: Artists ────────────────────────────────────────────────────────────

const artistPhotoUpload = multer({
  dest: os.tmpdir(), limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images only'))
});

router.get('/admin/artists', requireAuth, requireAdmin, async (req, res) => {
  const artists = await prisma.artist.findMany({ orderBy: { name: 'asc' } });
  res.json({ ok: true, artists });
});

router.post('/admin/artists', requireAuth, requireAdmin, async (req, res) => {
  const { name, bio } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, error: 'name required' });
  const artist = await prisma.artist.upsert({
    where: { name: String(name) },
    update: { bio: bio ? String(bio) : undefined },
    create: { name: String(name), bio: bio ? String(bio) : null }
  });
  res.json({ ok: true, artist });
});

router.patch('/admin/artists/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, bio } = req.body || {};
  const artist = await prisma.artist.findUnique({ where: { id: req.params.id } });
  if (!artist) return res.status(404).json({ ok: false, error: 'Artist not found' });
  const updated = await prisma.artist.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name: String(name) } : {}),
      ...(bio !== undefined ? { bio: bio ? String(bio) : null } : {}),
    }
  });
  res.json({ ok: true, artist: updated });
});

router.post('/admin/artists/:id/photo', requireAuth, requireAdmin, artistPhotoUpload.single('photo'), async (req, res) => {
  const artist = await prisma.artist.findUnique({ where: { id: req.params.id } });
  if (!artist) return res.status(404).json({ ok: false, error: 'Artist not found' });
  if (!req.file) return res.status(400).json({ ok: false, error: 'photo required' });
  if (artist.photoUrl && artist.photoUrl.startsWith('artists/')) await deleteFromS3(artist.photoUrl);
  const ext = path.extname(req.file.originalname || '') || '.jpg';
  const s3Key = `artists/${req.params.id}_photo${ext}`;
  await uploadToS3(req.file.path, s3Key, req.file.mimetype || 'image/jpeg');
  const updated = await prisma.artist.update({ where: { id: req.params.id }, data: { photoUrl: s3Key } });
  res.json({ ok: true, artist: updated });
});

// Link track to artist
router.post('/admin/tracks/:id/artist', requireAuth, requireAdmin, async (req, res) => {
  const { artistId } = req.body || {};
  const track = await prisma.track.findUnique({ where: { id: req.params.id } });
  if (!track) return res.status(404).json({ ok: false, error: 'Track not found' });
  const updated = await prisma.track.update({
    where: { id: req.params.id },
    data: { artistId: artistId || null }
  });
  res.json({ ok: true, track: updated });
});

export default router;
