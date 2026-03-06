import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, fetchStreamBlobUrl, login, tg, getToken, adminCoverUpload } from "./api.js";
import SpotifyPlayer from "./components/SpotifyPlayer";

function useHashRoute() {
  const [route, setRoute] = useState(window.location.hash || "#/");
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

function fmtDate(dt) {
  if (!dt) return "—";
  try { return new Date(dt).toLocaleString(); } catch { return String(dt); }
}

const S = {
  app: { minHeight: "100dvh", background: "#0a0a0a", color: "#fff", fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", paddingBottom: 140 },
  header: { position: "sticky", top: 0, zIndex: 30, background: "rgba(10,10,10,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  logo: { fontSize: 17, fontWeight: 700, letterSpacing: -0.5 },
  logoSub: { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 },
  headerBtns: { display: "flex", gap: 6 },
  btnPrimary: { background: "#1db954", color: "#000", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  btnSecondary: { background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, cursor: "pointer" },
  btnDanger: { background: "rgba(255,59,48,0.15)", color: "#ff6b6b", border: "1px solid rgba(255,59,48,0.3)", borderRadius: 20, padding: "6px 14px", fontSize: 12, cursor: "pointer" },
  page: { padding: "16px 16px 0" },
  userCard: { background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #1db954, #191414)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 },
  userName: { fontSize: 15, fontWeight: 600 },
  userSub: { fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 },
  badge: (active) => ({ display: "inline-block", background: active ? "rgba(29,185,84,0.2)" : "rgba(255,255,255,0.07)", color: active ? "#1db954" : "rgba(255,255,255,0.4)", border: `1px solid ${active ? "rgba(29,185,84,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "2px 8px", fontSize: 11, marginLeft: 6 }),
  searchWrap: { display: "flex", gap: 8, marginBottom: 16 },
  searchInput: { flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none" },
  searchBtn: { background: "#1db954", border: "none", borderRadius: 12, padding: "10px 16px", color: "#000", fontWeight: 600, fontSize: 13, cursor: "pointer", flexShrink: 0 },
  sectionTitle: { fontSize: 18, fontWeight: 700, marginBottom: 14, letterSpacing: -0.3 },
  grid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 },
  trackCard: { background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 10, cursor: "pointer", position: "relative", overflow: "hidden" },
  trackCover: { width: "100%", aspectRatio: "1", borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,0.07)", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 },
  trackTitle: { fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  trackArtist: { fontSize: 11, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 },
  trackFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  favBtn: (fav) => ({ background: "none", border: "none", fontSize: 16, cursor: "pointer", padding: 2, color: fav ? "#1db954" : "rgba(255,255,255,0.3)" }),
  tabBar: { position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40, background: "rgba(10,10,10,0.97)", borderTop: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", display: "flex", paddingBottom: "env(safe-area-inset-bottom)" },
  tabItem: (active) => ({ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 0 10px", gap: 3, cursor: "pointer", border: "none", background: "none", color: active ? "#1db954" : "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: active ? 600 : 400 }),
  tabIcon: { fontSize: 20, lineHeight: 1 },
  errorBox: { background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.3)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#ff6b6b", marginBottom: 16 },
  empty: { textAlign: "center", padding: "40px 16px", color: "rgba(255,255,255,0.3)", fontSize: 14 },
  adminInput: { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 8 },
  card: { background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: 600, marginBottom: 6 },
  cardSub: { fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 },
};

function TrackCard({ t, idx, list, onPlay, onToggleFav, fav, isPlaying, extraBadge, onAddToPlaylist }) {
  return (
    <div style={{ ...S.trackCard, background: isPlaying ? "rgba(29,185,84,0.1)" : S.trackCard.background, border: isPlaying ? "1px solid rgba(29,185,84,0.3)" : "1px solid transparent" }}>
      <div style={S.trackCover} onClick={() => onPlay(t, list, idx)}>
        {t.coverUrl ? <img src={t.coverUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={t.title} /> : "🎵"}
      </div>
      <div onClick={() => onPlay(t, list, idx)}>
        <div style={S.trackTitle}>{t.title}</div>
        <div style={S.trackArtist}>{t.artist || "—"}</div>
      </div>
      <div style={S.trackFooter}>
        <button style={S.favBtn(fav)} onClick={() => onToggleFav(t.id)}>{fav ? "♥" : "♡"}</button>
        {isPlaying && <span style={{ fontSize: 11, color: "#1db954" }}>▶ играет</span>}
        {!isPlaying && extraBadge && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{extraBadge}</span>}
        {onAddToPlaylist && !isPlaying && !extraBadge && (
          <button onClick={() => onAddToPlaylist(t)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 16, cursor: "pointer", padding: 2 }}>+</button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [q, setQ] = useState("");
  const [current, setCurrent] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [error, setError] = useState("");
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState(null);

  const isFav = useMemo(() => new Set(favorites.map((t) => t.id)), [favorites]);
  const isAdmin = me?.user?.role === "admin";
  const hasAccess = me?.accessActive;

  async function boot() {
    setError("");
    try {
      if (!getToken()) await login();
      const m = await api.me();
      setMe(m);
      const t = await api.tracks("");
      setTracks(t.tracks || []);
      setQueue(t.tracks || []);
      const f = await api.favorites();
      setFavorites(f.favorites || []);
      tg()?.ready?.();
      tg()?.expand?.();
      setReady(true);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  useEffect(() => { boot(); }, []);

  useEffect(() => {
    if (ready) api.playlists().then(r => setUserPlaylists(r.playlists || [])).catch(() => {});
  }, [ready]);

  async function toggleFav(trackId) {
    if (isFav.has(trackId)) await api.favDel(trackId);
    else await api.favAdd(trackId);
    const f = await api.favorites();
    setFavorites(f.favorites || []);
  }

  async function play(track, list, idx) {
    setError("");
    setCurrent(track);
    setAudioUrl("");
    if (Array.isArray(list)) setQueue(list);
    if (typeof idx === "number") setQueueIndex(idx);
    try {
      const url = await fetchStreamBlobUrl(track.id);
      setAudioUrl(url);
      api.recordListen(track.id).catch(() => {});
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  function playPrev() {
    if (queueIndex <= 0) return;
    const i = queueIndex - 1;
    play(queue[i], queue, i);
  }

  function playNext() {
    if (queueIndex < 0 || queueIndex >= queue.length - 1) return;
    const i = queueIndex + 1;
    play(queue[i], queue, i);
  }

  async function doSearch() {
    const t = await api.tracks(q);
    setTracks(t.tracks || []);
    setQueue(t.tracks || []);
    setQueueIndex(-1);
  }

  async function startTrial() {
    try { const m = await api.trialStart(); setMe(m); }
    catch (e) { setError(String(e.message || e)); }
  }

  async function subscribe() {
    try { const p = await api.createPayment(); if (p.confirmationUrl) window.location.href = p.confirmationUrl; }
    catch (e) { setError(String(e.message || e)); }
  }

  async function addTrackToPlaylist(playlistId, trackId) {
    await api.playlistAddTrack(playlistId, trackId);
    setAddToPlaylistTrack(null);
    const r = await api.playlists();
    setUserPlaylists(r.playlists || []);
  }

  // ── Pages ──────────────────────────────────────────────────────────────────

  function PageCatalog() {
    return (
      <div style={S.page}>
        {ready && me && (
          <div style={S.userCard}>
            <div style={S.avatar}>🎧</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.userName}>
                {me.user?.firstName || me.user?.username || "Слушатель"}
                <span style={S.badge(hasAccess)}>{hasAccess ? "✓ Доступ" : "Нет доступа"}</span>
              </div>
              <div style={S.userSub}>{me.user?.role || "user"}</div>
            </div>
            {!hasAccess && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <button style={S.btnPrimary} onClick={startTrial}>Пробный</button>
                <button style={S.btnSecondary} onClick={subscribe}>Купить</button>
              </div>
            )}
          </div>
        )}
        {error && <div style={S.errorBox}>{error}</div>}
        {!ready && (
          <div style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>Открой Mini App внутри Telegram</div>
            <button style={S.btnPrimary} onClick={boot}>Попробовать снова</button>
          </div>
        )}
        {ready && (
          <div>
            <div style={S.searchWrap}>
              <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} placeholder="Поиск треков..." style={S.searchInput} />
              <button style={S.searchBtn} onClick={doSearch}>Найти</button>
              {q && <button style={S.btnSecondary} onClick={async () => { setQ(""); const t = await api.tracks(""); setTracks(t.tracks || []); setQueue(t.tracks || []); setQueueIndex(-1); }}>✕</button>}
            </div>
            <div style={S.sectionTitle}>Треки</div>
            {tracks.length === 0 ? (
              <div style={S.empty}>Треков не найдено</div>
            ) : (
              <div style={S.grid}>
                {tracks.map((t, idx) => (
                  <TrackCard key={t.id} t={t} idx={idx} list={tracks} onPlay={play} onToggleFav={toggleFav} fav={isFav.has(t.id)} isPlaying={current?.id === t.id} onAddToPlaylist={setAddToPlaylistTrack} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function PageFavorites() {
    return (
      <div style={S.page}>
        <div style={S.sectionTitle}>Избранное</div>
        {favorites.length === 0 ? (
          <div style={S.empty}>Пока пусто — нажми ♡ у любого трека</div>
        ) : (
          <div style={S.grid}>
            {favorites.map((t, idx) => (
              <TrackCard key={t.id} t={t} idx={idx} list={favorites} onPlay={play} onToggleFav={toggleFav} fav={isFav.has(t.id)} isPlaying={current?.id === t.id} onAddToPlaylist={setAddToPlaylistTrack} />
            ))}
          </div>
        )}
      </div>
    );
  }

  function PageHistory() {
    const [history, setHistory] = useState([]);
    const [topTracks, setTopTracks] = useState([]);
    const [tab, setTab] = useState("recent");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      Promise.all([api.history(), api.topTracks()])
        .then(([h, top]) => { setHistory(h.history || []); setTopTracks(top.topTracks || []); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, []);

    const list = tab === "recent" ? history : topTracks;
    return (
      <div style={S.page}>
        <div style={S.sectionTitle}>История</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[["recent", "Недавние"], ["top", "Топ треков"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ ...(tab === key ? S.btnPrimary : S.btnSecondary), borderRadius: 20, padding: "7px 16px", fontSize: 13 }}>
              {label}
            </button>
          ))}
        </div>
        {loading && <div style={S.empty}>Загрузка...</div>}
        {!loading && list.length === 0 && <div style={S.empty}>Пока пусто — начни слушать треки</div>}
        <div style={S.grid}>
          {list.map((t, idx) => (
            <TrackCard key={t.id} t={t} idx={idx} list={list} onPlay={play} onToggleFav={toggleFav} fav={isFav.has(t.id)} isPlaying={current?.id === t.id} extraBadge={tab === "top" && t.userPlayCount ? `▶ ${t.userPlayCount}` : null} />
          ))}
        </div>
      </div>
    );
  }

  function PagePlaylists() {
    const [playlists, setPlaylists] = useState([]);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);
    const [openId, setOpenId] = useState(null);
    const [openPlaylist, setOpenPlaylist] = useState(null);
    const [renameId, setRenameId] = useState(null);
    const [renameName, setRenameName] = useState("");
    const [busy, setBusy] = useState(false);

    async function loadPlaylists() {
      const r = await api.playlists();
      setPlaylists(r.playlists || []);
      setUserPlaylists(r.playlists || []);
    }
    useEffect(() => { loadPlaylists(); }, []);

    async function openDetail(id) {
      const r = await api.playlistGet(id);
      setOpenPlaylist(r.playlist);
      setOpenId(id);
    }

    async function createPlaylist() {
      if (!newName.trim()) return;
      setBusy(true);
      try { await api.playlistCreate(newName.trim()); setNewName(""); setCreating(false); await loadPlaylists(); }
      catch (e) { console.error(e); } finally { setBusy(false); }
    }

    async function renamePlaylist(id) {
      if (!renameName.trim()) return;
      setBusy(true);
      try {
        await api.playlistRename(id, renameName.trim());
        setRenameId(null);
        await loadPlaylists();
        if (openPlaylist?.id === id) await openDetail(id);
      } catch (e) { console.error(e); } finally { setBusy(false); }
    }

    async function deletePlaylist(id) {
      setBusy(true);
      try {
        await api.playlistDelete(id);
        if (openId === id) { setOpenId(null); setOpenPlaylist(null); }
        await loadPlaylists();
      } catch (e) { console.error(e); } finally { setBusy(false); }
    }

    async function removeTrack(playlistId, trackId) {
      await api.playlistDelTrack(playlistId, trackId);
      await openDetail(playlistId);
    }

    if (openId && openPlaylist) {
      const ptracks = openPlaylist.tracks || [];
      return (
        <div style={S.page}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <button onClick={() => { setOpenId(null); setOpenPlaylist(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer", padding: 0 }}>‹</button>
            {renameId === openId ? (
              <div style={{ display: "flex", gap: 8, flex: 1 }}>
                <input value={renameName} onChange={e => setRenameName(e.target.value)} style={{ ...S.searchInput, flex: 1 }} onKeyDown={e => e.key === "Enter" && renamePlaylist(openId)} autoFocus />
                <button style={S.btnPrimary} onClick={() => renamePlaylist(openId)}>✓</button>
                <button style={S.btnSecondary} onClick={() => setRenameId(null)}>✕</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", flex: 1, gap: 8 }}>
                <div style={{ ...S.sectionTitle, margin: 0, flex: 1 }}>{openPlaylist.name}</div>
                <button onClick={() => { setRenameId(openId); setRenameName(openPlaylist.name); }} style={{ ...S.btnSecondary, padding: "5px 10px", fontSize: 12 }}>✏️</button>
                <button onClick={() => deletePlaylist(openId)} style={S.btnDanger}>🗑</button>
              </div>
            )}
          </div>
          {ptracks.length === 0 ? (
            <div style={S.empty}>Плейлист пуст — добавь треки через + в каталоге</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ptracks.map((t, idx) => (
                <div key={t.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, padding: "10px 12px" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", background: "rgba(255,255,255,0.08)", flexShrink: 0, cursor: "pointer" }} onClick={() => play(t, ptracks, idx)}>
                    {t.coverUrl ? <img src={t.coverUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>🎵</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => play(t, ptracks, idx)}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: current?.id === t.id ? "#1db954" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.artist || "—"}</div>
                  </div>
                  <button onClick={() => removeTrack(openId, t.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 18, cursor: "pointer", padding: 4 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={S.page}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={S.sectionTitle}>Плейлисты</div>
          <button style={S.btnPrimary} onClick={() => setCreating(c => !c)}>+ Создать</button>
        </div>
        {creating && (
          <div style={{ ...S.card, marginBottom: 12, display: "flex", gap: 8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Название плейлиста" style={{ ...S.searchInput, flex: 1 }} onKeyDown={e => e.key === "Enter" && createPlaylist()} autoFocus />
            <button style={S.btnPrimary} disabled={busy} onClick={createPlaylist}>✓</button>
          </div>
        )}
        {playlists.length === 0 && !creating && <div style={S.empty}>Нет плейлистов — создай первый</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {playlists.map(pl => {
            const count = pl._count?.playlistTracks ?? 0;
            const previewTrack = pl.playlistTracks?.[0]?.track;
            return (
              <div key={pl.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => openDetail(pl.id)}>
                <div style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,0.08)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {previewTrack?.coverUrl ? <img src={previewTrack.coverUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : "🎵"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{count} {count === 1 ? "трек" : count < 5 ? "трека" : "треков"}</div>
                </div>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }}>›</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Artist Detail (с альбомами) ──────────────────────────────────────────
  function PageArtistDetail({ artistId, onBack }) {
    const [artist, setArtist] = useState(null);
    const [artTracks, setArtTracks] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [openAlbum, setOpenAlbum] = useState(null);
    const [albumTracks, setAlbumTracks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      Promise.all([
        api.artist(artistId),
        fetch(`${import.meta.env.VITE_API_URL || ""}/artists/${artistId}/albums`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        }).then(r => r.json())
      ])
        .then(([artistRes, albumsRes]) => {
          setArtist(artistRes.artist);
          setArtTracks(artistRes.tracks || []);
          setAlbums(albumsRes.albums || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [artistId]);

    async function handleOpenAlbum(album) {
      setOpenAlbum(album);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/albums/${album.id}`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        }).then(r => r.json());
        setAlbumTracks(res.album?.tracks || []);
      } catch {}
    }

    if (loading) return <div style={S.page}><div style={S.empty}>Загрузка...</div></div>;
    if (!artist) return <div style={S.page}><div style={S.empty}>Артист не найден</div></div>;

    // Страница альбома
    if (openAlbum) {
      return (
        <div>
          <div style={{ ...S.page, paddingBottom: 0 }}>
            <button onClick={() => setOpenAlbum(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer", padding: "0 0 8px 0" }}>‹ Назад</button>
          </div>
          {/* Шапка альбома */}
          <div style={{ padding: "0 16px 20px", display: "flex", gap: 16, alignItems: "flex-end" }}>
            <div style={{ width: 110, height: 110, borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.07)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>
              {openAlbum.coverUrl
                ? <img src={openAlbum.coverUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                : "💿"}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Альбом</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{openAlbum.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                {artist.name}{openAlbum.year ? ` · ${openAlbum.year}` : ""}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                {albumTracks.length} {albumTracks.length === 1 ? "трек" : albumTracks.length < 5 ? "трека" : "треков"}
              </div>
            </div>
          </div>
          {/* Треки альбома */}
          <div style={{ padding: "0 16px" }}>
            {albumTracks.length === 0
              ? <div style={S.empty}>Треков в альбоме нет</div>
              : albumTracks.map((t, idx) => (
                <div key={t.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", cursor: "pointer", border: current?.id === t.id ? "1px solid rgba(29,185,84,0.4)" : "1px solid transparent" }} onClick={() => play(t, albumTracks, idx)}>
                  <div style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {current?.id === t.id
                      ? <span style={{ color: "#1db954", fontSize: 16 }}>▶</span>
                      : <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>{idx + 1}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: current?.id === t.id ? "#1db954" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                    {t.playCount > 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>▶ {t.playCount.toLocaleString()}</div>}
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      );
    }

    // Страница артиста
    return (
      <div>
        <div style={{ ...S.page, paddingBottom: 0 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer", padding: "0 0 8px 0" }}>‹ Назад</button>
        </div>
        {/* Шапка */}
        <div style={{ position: "relative", marginBottom: 20, minHeight: 180 }}>
          {artist.photoUrl ? (
            <img src={artist.photoUrl} alt={artist.name} style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ height: 180, background: "linear-gradient(135deg, #1a1a2e, #16213e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>🎤</div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 60%)" }} />
          <div style={{ position: "absolute", bottom: 16, left: 16 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>{artist.name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
              {artTracks.length} {artTracks.length === 1 ? "трек" : artTracks.length < 5 ? "трека" : "треков"}
              {albums.length > 0 && ` · ${albums.length} ${albums.length === 1 ? "альбом" : albums.length < 5 ? "альбома" : "альбомов"}`}
            </div>
          </div>
        </div>

        <div style={S.page}>
          {artist.bio && (
            <div style={{ ...S.card, marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{artist.bio}</div>
            </div>
          )}

          {/* Альбомы — горизонтальный скролл */}
          {albums.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ ...S.sectionTitle, marginBottom: 12 }}>Альбомы</div>
              <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, marginLeft: -16, paddingLeft: 16, marginRight: -16, paddingRight: 16 }}>
                {albums.map(album => (
                  <div key={album.id} onClick={() => handleOpenAlbum(album)} style={{ flexShrink: 0, width: 130, cursor: "pointer" }}>
                    <div style={{ width: 130, height: 130, borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.07)", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>
                      {album.coverUrl
                        ? <img src={album.coverUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                        : "💿"}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.title}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                      {album.year || ""}
                      {album.year && album._count?.tracks ? " · " : ""}
                      {album._count?.tracks ? `${album._count.tracks} тр.` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Популярные треки */}
          <div style={{ ...S.sectionTitle, marginBottom: 12 }}>Треки</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {artTracks.map((t, idx) => (
              <div key={t.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", cursor: "pointer", border: current?.id === t.id ? "1px solid rgba(29,185,84,0.4)" : "1px solid transparent" }} onClick={() => play(t, artTracks, idx)}>
                <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", background: "rgba(255,255,255,0.08)", flexShrink: 0 }}>
                  {t.coverUrl ? <img src={t.coverUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>🎵</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: current?.id === t.id ? "#1db954" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                  {t.playCount > 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>▶ {t.playCount.toLocaleString()}</div>}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>#{idx + 1}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function PageArtists() {
    const [artists, setArtists] = useState([]);
    const [openId, setOpenId] = useState(null);

    useEffect(() => {
      api.artists().then(r => setArtists(r.artists || [])).catch(() => {});
    }, []);

    if (openId) {
      return <PageArtistDetail artistId={openId} onBack={() => setOpenId(null)} />;
    }

    return (
      <div style={S.page}>
        <div style={S.sectionTitle}>Артисты</div>
        {artists.length === 0 && <div style={S.empty}>Нет артистов</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {artists.map(a => (
            <div key={a.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setOpenId(a.id)}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", background: "rgba(255,255,255,0.08)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                {a.photoUrl ? <img src={a.photoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : "🎤"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{a.name}</div>
                {a.bio && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.bio}</div>}
              </div>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }}>›</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function PageProfile() {
    return (
      <div style={S.page}>
        <div style={S.sectionTitle}>Профиль</div>
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={S.avatar}>👤</div>
            <div>
              <div style={S.cardTitle}>{me?.user?.firstName || me?.user?.username || "—"}</div>
              <div style={S.cardSub}>@{me?.user?.username || "—"} · {me?.user?.role}</div>
            </div>
          </div>
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Подписка</div>
          <div style={S.cardSub}>
            Статус: {hasAccess ? "✅ Активна" : "❌ Не активна"}<br />
            Триал: {fmtDate(me?.user?.trialEndsAt)}<br />
            Доступ до: {fmtDate(me?.user?.accessEndsAt)}
          </div>
          {!hasAccess && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={S.btnPrimary} onClick={startTrial}>Пробный период</button>
              <button style={S.btnSecondary} onClick={subscribe}>Купить подписку</button>
            </div>
          )}
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Оплата</div>
          <div style={S.cardSub}>После оплаты нажми «Обновить» чтобы активировать доступ.</div>
          <button style={{ ...S.btnSecondary, marginTop: 10 }} onClick={boot}>Обновить статус</button>
        </div>
      </div>
    );
  }

  function PageBillingReturn() {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.cardTitle}>✅ Оплата завершена</div>
          <div style={S.cardSub}>Нажми кнопку ниже чтобы проверить и активировать доступ.</div>
          <button style={{ ...S.btnPrimary, marginTop: 12 }} onClick={boot}>Проверить доступ</button>
        </div>
      </div>
    );
  }

  function PageAdmin() {
    const [adminTracks, setAdminTracks] = useState([]);
    const [newTitle, setNewTitle] = useState("");
    const [newArtist, setNewArtist] = useState("");
    const [fileById, setFileById] = useState({});
    const [coverById, setCoverById] = useState({});
    const [editById, setEditById] = useState({});
    const [busy, setBusy] = useState(false);
    const [adminError, setAdminError] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [adminTab, setAdminTab] = useState("tracks");

    // Artists state
    const [adminArtists, setAdminArtists] = useState([]);
    const [artistName, setArtistName] = useState("");
    const [artistBio, setArtistBio] = useState("");
    const [artistPhotoById, setArtistPhotoById] = useState({});
    const [editArtistById, setEditArtistById] = useState({});

    // Albums state
    const [adminAlbums, setAdminAlbums] = useState([]);
    const [newAlbumTitle, setNewAlbumTitle] = useState("");
    const [newAlbumArtistId, setNewAlbumArtistId] = useState("");
    const [newAlbumYear, setNewAlbumYear] = useState("");
    const [albumCoverById, setAlbumCoverById] = useState({});
    const [editAlbumById, setEditAlbumById] = useState({});
    const [openAlbumId, setOpenAlbumId] = useState(null);
    const [albumDetail, setAlbumDetail] = useState(null);
    const [addTrackToAlbumId, setAddTrackToAlbumId] = useState("");

    async function loadTracks() {
      try { const r = await api.adminTracks(); setAdminTracks(r.tracks || []); }
      catch (e) { setAdminError(String(e.message || e)); }
    }
    async function loadAdminArtists() {
      try { const r = await api.adminArtists(); setAdminArtists(r.artists || []); }
      catch (e) { setAdminError(String(e.message || e)); }
    }
    async function loadAdminAlbums() {
      try {
        const r = await fetch(`${import.meta.env.VITE_API_URL || ""}/admin/albums`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        }).then(res => res.json());
        setAdminAlbums(r.albums || []);
      } catch (e) { setAdminError(String(e.message || e)); }
    }

    useEffect(() => { loadTracks(); loadAdminArtists(); loadAdminAlbums(); }, []);

    // Track actions
    async function createTrack() {
      setBusy(true);
      try { await api.adminCreateTrack(newTitle, newArtist); setNewTitle(""); setNewArtist(""); await loadTracks(); }
      catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }
    async function uploadCover(id) {
      const f = coverById[id]; if (!f) return; setBusy(true);
      try { await adminCoverUpload(id, f); setCoverById(s => { const n = {...s}; delete n[id]; return n; }); await loadTracks(); }
      catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }
    async function uploadAudio(id) {
      const f = fileById[id]; if (!f) return; setBusy(true);
      try { await api.adminUpload(id, f); await loadTracks(); }
      catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }
    async function publishTrack(id) {
      setBusy(true);
      try { await api.adminPublish(id); await loadTracks(); }
      catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }
    function startEdit(t) { setEditById(s => ({ ...s, [t.id]: { title: t.title, artist: t.artist || "" } })); }
    function cancelEdit(id) { setEditById(s => { const n = {...s}; delete n[id]; return n; }); }
    async function saveEdit(id) {
      const e = editById[id]; if (!e) return; setBusy(true);
      try { await api.adminUpdateTrack(id, e.title, e.artist); cancelEdit(id); await loadTracks(); }
      catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }
    async function deleteTrack(id) {
      setBusy(true);
      try { await api.adminDeleteTrack(id); setConfirmDelete(null); await loadTracks(); }
      catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }

    // Artist actions
    async function createArtist() {
      if (!artistName.trim()) return; setBusy(true);
      try { await api.adminCreateArtist(artistName.trim(), artistBio.trim()); setArtistName(""); setArtistBio(""); await loadAdminArtists(); }
      catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }
    async function saveArtist(id) {
      const e = editArtistById[id]; if (!e) return; setBusy(true);
      try { await api.adminUpdateArtist(id, e.name, e.bio); setEditArtistById(s => { const n = {...s}; delete n[id]; return n; }); await loadAdminArtists(); }
      catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }
    async function uploadArtistPhoto(id) {
      const f = artistPhotoById[id]; if (!f) return; setBusy(true);
      try { await api.adminArtistPhoto(id, f); setArtistPhotoById(s => { const n = {...s}; delete n[id]; return n; }); await loadAdminArtists(); }
      catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }

    // Album actions
    async function createAlbum() {
      if (!newAlbumTitle.trim() || !newAlbumArtistId) return; setBusy(true);
      try {
        await fetch(`${import.meta.env.VITE_API_URL || ""}/admin/albums`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ title: newAlbumTitle.trim(), artistId: newAlbumArtistId, year: newAlbumYear || null })
        });
        setNewAlbumTitle(""); setNewAlbumArtistId(""); setNewAlbumYear("");
        await loadAdminAlbums();
      } catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }

    async function uploadAlbumCover(id) {
      const f = albumCoverById[id]; if (!f) return; setBusy(true);
      try {
        const fd = new FormData(); fd.append("cover", f);
        await fetch(`${import.meta.env.VITE_API_URL || ""}/admin/albums/${id}/cover`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
          body: fd
        });
        setAlbumCoverById(s => { const n = {...s}; delete n[id]; return n; });
        await loadAdminAlbums();
        if (openAlbumId === id) await openAlbumDetail(id);
      } catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }

    async function saveAlbumEdit(id) {
      const e = editAlbumById[id]; if (!e) return; setBusy(true);
      try {
        await fetch(`${import.meta.env.VITE_API_URL || ""}/admin/albums/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ title: e.title, year: e.year || null })
        });
        setEditAlbumById(s => { const n = {...s}; delete n[id]; return n; });
        await loadAdminAlbums();
        if (openAlbumId === id) await openAlbumDetail(id);
      } catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }

    async function deleteAlbum(id) {
      setBusy(true);
      try {
        await fetch(`${import.meta.env.VITE_API_URL || ""}/admin/albums/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        if (openAlbumId === id) { setOpenAlbumId(null); setAlbumDetail(null); }
        await loadAdminAlbums();
      } catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }

    async function openAlbumDetail(id) {
      try {
        const r = await fetch(`${import.meta.env.VITE_API_URL || ""}/albums/${id}`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        }).then(res => res.json());
        setAlbumDetail(r.album);
        setOpenAlbumId(id);
      } catch (e) { setAdminError(String(e.message || e)); }
    }

    async function addTrackToAlbum(albumId) {
      if (!addTrackToAlbumId.trim()) return; setBusy(true);
      try {
        await fetch(`${import.meta.env.VITE_API_URL || ""}/admin/albums/${albumId}/tracks`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ trackId: addTrackToAlbumId.trim() })
        });
        setAddTrackToAlbumId("");
        await openAlbumDetail(albumId);
      } catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }

    async function removeTrackFromAlbum(albumId, trackId) {
      setBusy(true);
      try {
        await fetch(`${import.meta.env.VITE_API_URL || ""}/admin/albums/${albumId}/tracks/${trackId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        await openAlbumDetail(albumId);
      } catch (e) { setAdminError(String(e.message || e)); } finally { setBusy(false); }
    }

    if (!isAdmin) {
      return <div style={S.page}><div style={S.empty}>Только для администратора</div></div>;
    }

    return (
      <div style={S.page}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[["tracks", "Треки"], ["artists", "Артисты"], ["albums", "Альбомы"]].map(([key, label]) => (
            <button key={key} onClick={() => setAdminTab(key)} style={{ ...(adminTab === key ? S.btnPrimary : S.btnSecondary), borderRadius: 20, padding: "7px 16px", fontSize: 13 }}>
              {label}
            </button>
          ))}
        </div>

        {adminError && <div style={S.errorBox}>{adminError}</div>}

        {/* ── Вкладка Артисты ── */}
        {adminTab === "artists" && (
          <div>
            <div style={S.card}>
              <div style={S.cardTitle}>Добавить артиста</div>
              <input value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="Имя" style={S.adminInput} />
              <input value={artistBio} onChange={e => setArtistBio(e.target.value)} placeholder="Описание (необязательно)" style={S.adminInput} />
              <button disabled={busy || !artistName.trim()} style={S.btnPrimary} onClick={createArtist}>➕ Создать</button>
            </div>
            {adminArtists.map(a => (
              <div key={a.id} style={S.card}>
                {editArtistById[a.id] ? (
                  <div style={{ marginBottom: 10 }}>
                    <input value={editArtistById[a.id].name} onChange={e => setEditArtistById(s => ({ ...s, [a.id]: { ...s[a.id], name: e.target.value } }))} placeholder="Имя" style={{ ...S.adminInput, marginBottom: 6 }} />
                    <input value={editArtistById[a.id].bio} onChange={e => setEditArtistById(s => ({ ...s, [a.id]: { ...s[a.id], bio: e.target.value } }))} placeholder="Описание" style={{ ...S.adminInput, marginBottom: 8 }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button disabled={busy} style={S.btnPrimary} onClick={() => saveArtist(a.id)}>✓ Сохранить</button>
                      <button style={S.btnSecondary} onClick={() => setEditArtistById(s => { const n = {...s}; delete n[a.id]; return n; })}>Отмена</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{a.name}</div>
                      {a.bio && <div style={S.cardSub}>{a.bio}</div>}
                    </div>
                    <button onClick={() => setEditArtistById(s => ({ ...s, [a.id]: { name: a.name, bio: a.bio || "" } }))} style={{ ...S.btnSecondary, padding: "5px 10px", fontSize: 12 }}>✏️</button>
                  </div>
                )}
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>📷 Фото</div>
                <input type="file" accept="image/*" onChange={e => setArtistPhotoById(s => ({ ...s, [a.id]: e.target.files?.[0] }))} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 6 }} />
                <button disabled={busy || !artistPhotoById[a.id]} style={S.btnSecondary} onClick={() => uploadArtistPhoto(a.id)}>📷 Upload фото</button>
              </div>
            ))}
          </div>
        )}

        {/* ── Вкладка Треки ── */}
        {adminTab === "tracks" && (
          <div>
            <div style={S.card}>
              <div style={S.cardTitle}>Добавить трек</div>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Название" style={S.adminInput} />
              <input value={newArtist} onChange={e => setNewArtist(e.target.value)} placeholder="Артист" style={S.adminInput} />
              <button disabled={busy || !newTitle} style={S.btnPrimary} onClick={createTrack}>➕ Создать</button>
            </div>
            {adminTracks.map(t => {
              const editing = editById[t.id];
              const isDel = confirmDelete === t.id;
              return (
                <div key={t.id} style={{ ...S.card, border: isDel ? "1px solid rgba(255,59,48,0.4)" : "1px solid transparent" }}>
                  {editing ? (
                    <div style={{ marginBottom: 10 }}>
                      <input value={editing.title} onChange={e => setEditById(s => ({ ...s, [t.id]: { ...s[t.id], title: e.target.value } }))} placeholder="Название" style={{ ...S.adminInput, marginBottom: 6 }} />
                      <input value={editing.artist} onChange={e => setEditById(s => ({ ...s, [t.id]: { ...s[t.id], artist: e.target.value } }))} placeholder="Артист" style={{ ...S.adminInput, marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button disabled={busy || !editing.title} style={S.btnPrimary} onClick={() => saveEdit(t.id)}>✓ Сохранить</button>
                        <button style={S.btnSecondary} onClick={() => cancelEdit(t.id)}>Отмена</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{t.title}</span>
                          <span>{t.isPublished ? "✅" : "⏳"}</span>
                        </div>
                        <div style={S.cardSub}>{t.artist || "—"}</div>
                        {t.albumId && <div style={{ fontSize: 11, color: "rgba(29,185,84,0.6)", marginTop: 2 }}>💿 В альбоме</div>}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                        <button onClick={() => startEdit(t)} style={{ ...S.btnSecondary, padding: "5px 10px", fontSize: 12 }}>✏️</button>
                        {!isDel ? (
                          <button onClick={() => setConfirmDelete(t.id)} style={S.btnDanger}>🗑</button>
                        ) : (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button disabled={busy} onClick={() => deleteTrack(t.id)} style={{ background: "rgba(255,59,48,0.8)", color: "#fff", border: "none", borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Удалить</button>
                            <button onClick={() => setConfirmDelete(null)} style={S.btnSecondary}>✕</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>🎵 Аудио</div>
                    <input type="file" accept="audio/*" onChange={e => setFileById(s => ({ ...s, [t.id]: e.target.files?.[0] }))} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                    <button disabled={busy || !fileById[t.id]} style={S.btnSecondary} onClick={() => uploadAudio(t.id)}>⬆ Upload аудио</button>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>🖼 Обложка</div>
                    <input type="file" accept="image/*" onChange={e => setCoverById(s => ({ ...s, [t.id]: e.target.files?.[0] }))} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                    <button disabled={busy || !coverById[t.id]} style={S.btnSecondary} onClick={() => uploadCover(t.id)}>🖼 Upload обложку</button>
                    <button disabled={busy || !t.filePath || t.isPublished} style={{ ...S.btnPrimary, marginTop: 4 }} onClick={() => publishTrack(t.id)}>🚀 Publish</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Вкладка Альбомы ── */}
        {adminTab === "albums" && (
          <div>
            {/* Если открыт конкретный альбом */}
            {openAlbumId && albumDetail ? (
              <div>
                <button onClick={() => { setOpenAlbumId(null); setAlbumDetail(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 16, cursor: "pointer", marginBottom: 12, padding: 0 }}>‹ Все альбомы</button>
                <div style={S.card}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                    <div style={{ width: 60, height: 60, borderRadius: 8, overflow: "hidden", background: "rgba(255,255,255,0.07)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                      {albumDetail.coverUrl ? <img src={albumDetail.coverUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : "💿"}
                    </div>
                    <div style={{ flex: 1 }}>
                      {editAlbumById[openAlbumId] ? (
                        <div>
                          <input value={editAlbumById[openAlbumId].title} onChange={e => setEditAlbumById(s => ({ ...s, [openAlbumId]: { ...s[openAlbumId], title: e.target.value } }))} style={{ ...S.adminInput, marginBottom: 6 }} />
                          <input value={editAlbumById[openAlbumId].year} onChange={e => setEditAlbumById(s => ({ ...s, [openAlbumId]: { ...s[openAlbumId], year: e.target.value } }))} placeholder="Год" style={{ ...S.adminInput, marginBottom: 8 }} />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button disabled={busy} style={S.btnPrimary} onClick={() => saveAlbumEdit(openAlbumId)}>✓</button>
                            <button style={S.btnSecondary} onClick={() => setEditAlbumById(s => { const n = {...s}; delete n[openAlbumId]; return n; })}>✕</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{albumDetail.title}</div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{albumDetail.artist?.name}{albumDetail.year ? ` · ${albumDetail.year}` : ""}</div>
                          <button onClick={() => setEditAlbumById(s => ({ ...s, [openAlbumId]: { title: albumDetail.title, year: albumDetail.year || "" } }))} style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 11, marginTop: 6 }}>✏️ Редактировать</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Обложка альбома */}
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>🖼 Обложка альбома</div>
                  <input type="file" accept="image/*" onChange={e => setAlbumCoverById(s => ({ ...s, [openAlbumId]: e.target.files?.[0] }))} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 6 }} />
                  <button disabled={busy || !albumCoverById[openAlbumId]} style={S.btnSecondary} onClick={() => uploadAlbumCover(openAlbumId)}>🖼 Загрузить обложку</button>
                </div>

                {/* Треки альбома */}
                <div style={{ ...S.cardTitle, marginBottom: 8 }}>Треки в альбоме ({albumDetail.tracks?.length || 0})</div>
                {(albumDetail.tracks || []).map(t => (
                  <div key={t.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{t.id}</div>
                    </div>
                    <button disabled={busy} onClick={() => removeTrackFromAlbum(openAlbumId, t.id)} style={{ ...S.btnDanger, padding: "4px 10px", fontSize: 11 }}>Убрать</button>
                  </div>
                ))}

                {/* Добавить трек в альбом */}
                <div style={{ ...S.card, marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Добавить трек по ID</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={addTrackToAlbumId} onChange={e => setAddTrackToAlbumId(e.target.value)} placeholder="ID трека" style={{ ...S.adminInput, flex: 1, marginBottom: 0 }} />
                    <button disabled={busy || !addTrackToAlbumId.trim()} style={S.btnPrimary} onClick={() => addTrackToAlbum(openAlbumId)}>+</button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {/* Создать альбом */}
                <div style={S.card}>
                  <div style={S.cardTitle}>Создать альбом</div>
                  <input value={newAlbumTitle} onChange={e => setNewAlbumTitle(e.target.value)} placeholder="Название альбома" style={S.adminInput} />
                  <select value={newAlbumArtistId} onChange={e => setNewAlbumArtistId(e.target.value)} style={{ ...S.adminInput, appearance: "none" }}>
                    <option value="">Выбери артиста...</option>
                    {adminArtists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <input value={newAlbumYear} onChange={e => setNewAlbumYear(e.target.value)} placeholder="Год (необязательно)" type="number" style={S.adminInput} />
                  <button disabled={busy || !newAlbumTitle.trim() || !newAlbumArtistId} style={S.btnPrimary} onClick={createAlbum}>➕ Создать</button>
                </div>

                {/* Список альбомов */}
                {adminAlbums.length === 0 && <div style={S.empty}>Альбомов нет — они создаются автоматически при импорте треков</div>}
                {adminAlbums.map(album => (
                  <div key={album.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => openAlbumDetail(album.id)}>
                    <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", background: "rgba(255,255,255,0.07)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                      {album.coverUrl ? <img src={album.coverUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : "💿"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.title}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                        {album.artist?.name}{album.year ? ` · ${album.year}` : ""} · {album._count?.tracks || 0} тр.
                      </div>
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }}>›</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Routing ────────────────────────────────────────────────────────────────

  let page;
  if (route.startsWith("#/favorites")) page = <PageFavorites />;
  else if (route.startsWith("#/history")) page = <PageHistory />;
  else if (route.startsWith("#/playlists")) page = <PagePlaylists />;
  else if (route.startsWith("#/artists")) page = <PageArtists />;
  else if (route.startsWith("#/profile")) page = <PageProfile />;
  else if (route.startsWith("#/billing/return")) page = <PageBillingReturn />;
  else if (route.startsWith("#/admin")) page = <PageAdmin />;
  else page = <PageCatalog />;

  const tabs = [
    { href: "#/", icon: "🏠", label: "Каталог", match: r => r === "#/" || r === "" },
    { href: "#/playlists", icon: "🎵", label: "Плейлисты", match: r => r.startsWith("#/playlists") },
    { href: "#/artists", icon: "🎤", label: "Артисты", match: r => r.startsWith("#/artists") },
    { href: "#/history", icon: "🕐", label: "История", match: r => r.startsWith("#/history") },
    { href: "#/profile", icon: "👤", label: "Профиль", match: r => r.startsWith("#/profile") },
    ...(isAdmin ? [{ href: "#/admin", icon: "🛠", label: "Admin", match: r => r.startsWith("#/admin") }] : []),
  ];

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div>
          <div style={S.logo}>🎧 Music</div>
          <div style={S.logoSub}>Telegram Mini App</div>
        </div>
        <div style={S.headerBtns}>
          <button style={S.btnSecondary} onClick={boot}>↺</button>
        </div>
      </div>

      {page}

      {addToPlaylistTrack && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end" }} onClick={() => setAddToPlaylistTrack(null)}>
          <div style={{ width: "100%", background: "#1a1a1a", borderRadius: "20px 20px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Добавить в плейлист</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>{addToPlaylistTrack.title}</div>
            {userPlaylists.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Нет плейлистов — создай в разделе «Плейлисты»</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                {userPlaylists.map(pl => (
                  <button key={pl.id} onClick={() => addTrackToPlaylist(pl.id, addToPlaylistTrack.id)} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 12, padding: "12px 16px", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer", textAlign: "left" }}>
                    🎵 {pl.name}
                    <span style={{ float: "right", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{pl._count?.playlistTracks ?? 0} тр.</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ paddingBottom: current ? 60 : 0 }}>
        <SpotifyPlayer ref={playerRef} track={current} audioUrl={audioUrl} onPrev={playPrev} onNext={playNext} />
      </div>

      <div style={{ ...S.tabBar, bottom: current ? 84 : 0 }}>
        {tabs.map(tab => (
          <a key={tab.href} href={tab.href} style={{ textDecoration: "none", flex: 1 }}>
            <div style={S.tabItem(tab.match(route))}>
              <span style={S.tabIcon}>{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
