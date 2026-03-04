const API = import.meta.env.VITE_API_BASE_URL;

export function tg() {
  return window.Telegram?.WebApp;
}

export function getInitData() {
  return tg()?.initData || '';
}

export function getToken() {
  return localStorage.getItem('token') || '';
}

export function setToken(t) {
  localStorage.setItem('token', t);
}

async function raw(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
    }
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export async function login() {
  const initData = getInitData();
  const j = await raw('/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  });
  setToken(j.token);
  return j;
}

export const api = {
  me: () => raw('/me'),
  trialStart: () => raw('/me/trial/start', { method: 'POST' }),
  tracks: (search='') => raw(`/tracks?search=${encodeURIComponent(search)}`),
  favorites: () => raw('/me/favorites'),
  favAdd: (id) => raw(`/me/favorites/${id}`, { method: 'POST' }),
  favDel: (id) => raw(`/me/favorites/${id}`, { method: 'DELETE' }),
  createPayment: () => raw('/billing/yookassa/create-payment', { method: 'POST' }),

  adminTracks: () => raw('/admin/tracks'),
  adminCreateTrack: (title, artist) => raw('/admin/tracks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, artist })
  }),
  adminUpload: async (trackId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`${API}/admin/tracks/${trackId}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  },
  adminPublish: (trackId) => raw(`/admin/tracks/${trackId}/publish`, { method: 'POST' })
};

export async function fetchStreamBlobUrl(trackId) {
  const r = await fetch(`${API}/tracks/${trackId}/stream`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || `HTTP ${r.status}`);
  }
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}
