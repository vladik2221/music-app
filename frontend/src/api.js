const API = import.meta.env.VITE_API_BASE_URL;

export function tg() { return window.Telegram?.WebApp; }
export function getInitData() { return tg()?.initData || ''; }
export function getToken() { return localStorage.getItem('token') || ''; }
export function setToken(t) { localStorage.setItem('token', t); }

async function raw(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) }
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export async function login() {
  const j = await raw('/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: getInitData() })
  });
  setToken(j.token);
  return j;
}

export const api = {
  me:          () => raw('/me'),
  trialStart:  () => raw('/me/trial/start', { method: 'POST' }),
  tracks:      (search = '') => raw(`/tracks?search=${encodeURIComponent(search)}`),
  track:       (id) => raw(`/tracks/${id}`),

  // Favorites
  favorites:   () => raw('/me/favorites'),
  favAdd:      (id) => raw(`/me/favorites/${id}`, { method: 'POST' }),
  favDel:      (id) => raw(`/me/favorites/${id}`, { method: 'DELETE' }),

  // History
  history:     () => raw('/me/history'),
  topTracks:   () => raw('/me/top-tracks'),
  recordListen:(id) => raw(`/tracks/${id}/listen`, { method: 'POST' }),

  // Playlists
  playlists:        () => raw('/me/playlists'),
  playlistGet:      (id) => raw(`/me/playlists/${id}`),
  playlistCreate:   (name) => raw('/me/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }),
  playlistRename:   (id, name) => raw(`/me/playlists/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }),
  playlistDelete:   (id) => raw(`/me/playlists/${id}`, { method: 'DELETE' }),
  playlistAddTrack: (id, trackId) => raw(`/me/playlists/${id}/tracks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId }) }),
  playlistDelTrack: (id, trackId) => raw(`/me/playlists/${id}/tracks/${trackId}`, { method: 'DELETE' }),

  // Artists
  artists:     () => raw('/artists'),
  artist:      (id) => raw(`/artists/${id}`),

  // Payment
  createPayment: () => raw('/billing/yookassa/create-payment', { method: 'POST' }),

  // Admin — tracks
  adminTracks:       () => raw('/admin/tracks'),
  adminCreateTrack:  (title, artist) => raw('/admin/tracks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, artist }) }),
  adminUpdateTrack:  (id, title, artist) => raw(`/admin/tracks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, artist }) }),
  adminPublish:      (id) => raw(`/admin/tracks/${id}/publish`, { method: 'POST' }),
  adminDeleteTrack:  (id) => raw(`/admin/tracks/${id}`, { method: 'DELETE' }),
  adminLinkArtist:   (trackId, artistId) => raw(`/admin/tracks/${trackId}/artist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artistId }) }),

  adminUpload: async (trackId, file) => {
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch(`${API}/admin/tracks/${trackId}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  },

  // Admin — artists
  adminArtists:       () => raw('/admin/artists'),
  adminCreateArtist:  (name, bio) => raw('/admin/artists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, bio }) }),
  adminUpdateArtist:  (id, name, bio) => raw(`/admin/artists/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, bio }) }),
  adminArtistPhoto: async (artistId, file) => {
    const fd = new FormData(); fd.append('photo', file);
    const r = await fetch(`${API}/admin/artists/${artistId}/photo`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  },
};

export async function adminCoverUpload(trackId, file) {
  const fd = new FormData(); fd.append('cover', file);
  const r = await fetch(`${API}/admin/tracks/${trackId}/cover`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export async function fetchStreamBlobUrl(trackId) {
  return `${API}/tracks/${trackId}/stream?token=${encodeURIComponent(getToken())}`;
}
