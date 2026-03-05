import jwt from 'jsonwebtoken';
import { validate, parse } from '@tma.js/init-data-node';
import { prisma } from './prisma.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export async function authTelegram(req, res) {
  const { initData } = req.body || {};
  if (!initData) return res.status(400).json({ ok: false, error: 'initData required' });

  try {
    validate(initData, BOT_TOKEN);
    const data = parse(initData);
    const tgUser = data.user;
    if (!tgUser?.id) return res.status(400).json({ ok: false, error: 'No user in initData' });

    const telegramId = String(tgUser.id);
    const role = ADMIN_IDS.includes(telegramId) ? 'admin' : 'user';

    const user = await prisma.user.upsert({
      where: { telegramId },
      update: {
        username: tgUser.username ?? null,
        firstName: tgUser.firstName ?? tgUser.first_name ?? null,
        role
      },
      create: {
        telegramId,
        username: tgUser.username ?? null,
        firstName: tgUser.firstName ?? tgUser.first_name ?? null,
        role
      }
    });

    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ ok: true, token, user: sanitizeUser(user) });
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'Invalid initData', details: String(e?.message || e) });
  }
}

export function requireAuth(req, res, next) {
  // Support both Authorization header and ?token= query param (needed for audio src)
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer (.+)$/);
  const raw = m ? m[1] : (req.query.token || '');
  if (!raw) return res.status(401).json({ ok: false, error: 'Missing Bearer token' });
  try {
    req.auth = jwt.verify(raw, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.auth?.role !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  return next();
}

export async function attachUser(req, res, next) {
  const userId = req.auth?.sub;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(401).json({ ok: false, error: 'User not found' });
  req.user = user;
  return next();
}

export function sanitizeUser(u) {
  return {
    id: u.id,
    telegramId: u.telegramId,
    username: u.username,
    firstName: u.firstName,
    role: u.role,
    trialEndsAt: u.trialEndsAt,
    accessEndsAt: u.accessEndsAt
  };
}
