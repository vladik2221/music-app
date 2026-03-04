import crypto from 'crypto';

export function now() { return new Date(); }

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isAccessActive(user) {
  const t = Date.now();
  const trialOk = user.trialEndsAt && user.trialEndsAt.getTime() > t;
  const paidOk = user.accessEndsAt && user.accessEndsAt.getTime() > t;
  return Boolean(trialOk || paidOk);
}

export function idempotenceKey() {
  return crypto.randomUUID();
}

export function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
