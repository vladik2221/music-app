import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, fetchStreamBlobUrl, login, tg, getToken } from "./api.js";
import SpotifyPlayer from "./components/SpotifyPlayer";

// ─── helpers ────────────────────────────────────────────────────────────────

function useHashRoute() {
  const [route, setRoute] = useState(window.location.hash || "#/");
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

function fmt(dt) {
  if (!dt) return "—";
  try { return new Date(dt).toLocaleString(); }
  catch { return String(dt); }
}

// ─── styles ─────────────────────────────────────────────────────────────────

const S = {
  app: {
    minHeight: "100dvh",
    background: "#0a0a0a",
    color: "#fff",
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    paddingBottom: 140,
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 30,
    background: "rgba(10,10,10,0.92)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  logo: { fontSize: 17, fontWeight: 700, letterSpacing: -0.5 },
  logoSub: { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 },
  headerBtns: { display: "flex", gap: 6 },
  btnPrimary: {
    background: "#1db954",
    color: "#000",
    border: "none",
    borderRadius: 20,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnSecondary: {
    background: "rgba(255,255,255,0.1)",
    color: "#fff",
    border: "none",
    borderRadius: 20,
    padding: "6px 14px",
    fontSize: 12,
    cursor: "pointer",
  },
  page: { padding: "16px 16px 0" },
  // User card
  userCard: {
    background: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: "14px 16px",
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44, height: 44,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #1db954, #191414)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, flexShrink: 0,
  },
  userName: { fontSize: 15, fontWeight: 600 },
  userSub: { fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 },
  badge: (active) => ({
    display: "inline-block",
    background: active ? "rgba(29,185,84,0.2)" : "rgba(255,255,255,0.07)",
    color: active ? "#1db954" : "rgba(255,255,255,0.4)",
    border: `1px solid ${active ? "rgba(29,185,84,0.4)" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 10,
    padding: "2px 8px",
    fontSize: 11,
    marginLeft: 6,
  }),
  // Search
  searchWrap: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "10px 14px",
    color: "#fff",
    fontSize: 14,
    outline: "none",
  },
  searchBtn: {
    background: "#1db954",
    border: "none",
    borderRadius: 12,
    padding: "10px 16px",
    color: "#000",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    flexShrink: 0,
  },
  // Section title
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  // Track grid
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
  },
  // Track card
  trackCard: {
    background: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 10,
    cursor: "pointer",
    transition: "background 0.15s",
    position: "relative",
    overflow: "hidden",
  },
  trackCover: {
    width: "100%",
    aspectRatio: "1",
    borderRadius: 10,
    overflow: "hidden",
    background: "rgba(255,255,255,0.07)",
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
  },
  trackTitle: {
    fontSize: 13,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  trackArtist: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 2,
  },
  trackFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  favBtn: (fav) => ({
    background: "none",
    border: "none",
    fontSize: 16,
    cursor: "pointer",
    padding: 2,
    color: fav ? "#1db954" : "rgba(255,255,255,0.3)",
  }),
  // Tab bar
  tabBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    background: "rgba(10,10,10,0.97)",
    borderTop: "1px solid rgba(255,255,255,0.07)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    display: "flex",
    paddingBottom: "env(safe-area-inset-bottom)",
  },
  tabItem: (active) => ({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 0 10px",
    gap: 3,
    cursor: "pointer",
    border: "none",
    background: "none",
    color: active ? "#1db954" : "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: active ? 600 : 400,
    transition: "color 0.15s",
  }),
  tabIcon: { fontSize: 20, lineHeight: 1 },
  // Error
  errorBox: {
    background: "rgba(255,59,48,0.1)",
    border: "1px solid rgba(255,59,48,0.3)",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    color: "#ff6b6b",
    marginBottom: 16,
  },
  // Empty state
  empty: {
    textAlign: "center",
    padding: "40px 16px",
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
  },
  // Admin input
  adminInput: {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "10px 14px",
    color: "#fff",
    fontSize: 14,
    outline: "none",
    marginBottom: 8,
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: 600, marginBottom: 6 },
  cardSub: { fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 },
};

// ─── components ─────────────────────────────────────────────────────────────

function TrackCard({ t, idx, list, onPlay, onToggleFav, fav, isPlaying }) {
  return (
    <div
      style={{
        ...S.trackCard,
        background: isPlaying ? "rgba(29,185,84,0.1)" : S.trackCard.background,
        border: isPlaying ? "1px solid rgba(29,185,84,0.3)" : "1px solid transparent",
      }}
    >
      <div style={S.trackCover} onClick={() => onPlay(t, list, idx)}>
        {t.coverUrl ? (
          <img
            src={t.coverUrl.startsWith("http") ? t.coverUrl : (import.meta.env.VITE_API_BASE_URL || "") + t.coverUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            alt={t.title}
          />
        ) : "🎵"}
      </div>

      <div onClick={() => onPlay(t, list, idx)}>
        <div style={S.trackTitle}>{t.title}</div>
        <div style={S.trackArtist}>{t.artist || "—"}</div>
      </div>

      <div style={S.trackFooter}>
        <button style={S.favBtn(fav)} onClick={() => onToggleFav(t.id)}>
          {fav ? "♥" : "♡"}
        </button>
        {isPlaying && <span style={{ fontSize: 11, color: "#1db954" }}>▶ играет</span>}
      </div>
    </div>
  );
}

// ─── main app ───────────────────────────────────────────────────────────────

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
      setReady(false);
    }
  }

  useEffect(() => { boot(); }, []);

  async function refreshFavorites() {
    const f = await api.favorites();
    setFavorites(f.favorites || []);
  }

  async function toggleFav(trackId) {
    if (isFav.has(trackId)) await api.favDel(trackId);
    else await api.favAdd(trackId);
    await refreshFavorites();
  }

  async function play(track, list = null, idx = null) {
    setError("");
    setCurrent(track);
    setAudioUrl("");
    if (Array.isArray(list)) setQueue(list);
    if (typeof idx === "number") setQueueIndex(idx);
    try {
      const url = await fetchStreamBlobUrl(track.id);
      setAudioUrl(url);
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
    try {
      const m = await api.trialStart();
      setMe(m);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function subscribe() {
    try {
      const p = await api.createPayment();
      if (p.confirmationUrl) window.location.href = p.confirmationUrl;
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  // ── pages ─────────────────────────────────────────────────────────────────

  function PageCatalog() {
    return (
      <div style={S.page}>
        {/* User card */}
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
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>
              Открой Mini App внутри Telegram
            </div>
            <button style={S.btnPrimary} onClick={boot}>Попробовать снова</button>
          </div>
        )}

        {/* Search */}
        {ready && (
          <>
            <div style={S.searchWrap}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="Поиск треков..."
                style={S.searchInput}
              />
              <button style={S.searchBtn} onClick={doSearch}>Найти</button>
              {q && (
                <button style={S.btnSecondary} onClick={async () => {
                  setQ("");
                  const t = await api.tracks("");
                  setTracks(t.tracks || []);
                  setQueue(t.tracks || []);
                  setQueueIndex(-1);
                }}>✕</button>
              )}
            </div>

            <div style={S.sectionTitle}>Треки</div>

            {tracks.length === 0 ? (
              <div style={S.empty}>Треков не найдено</div>
            ) : (
              <div style={S.grid}>
                {tracks.map((t, idx) => (
                  <TrackCard
                    key={t.id} t={t} idx={idx} list={tracks}
                    onPlay={play} onToggleFav={toggleFav}
                    fav={isFav.has(t.id)}
                    isPlaying={current?.id === t.id}
                  />
                ))}
              </div>
            )}
          </>
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
              <TrackCard
                key={t.id} t={t} idx={idx} list={favorites}
                onPlay={play} onToggleFav={toggleFav}
                fav={isFav.has(t.id)}
                isPlaying={current?.id === t.id}
              />
            ))}
          </div>
        )}
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
            Триал: {fmt(me?.user?.trialEndsAt)}<br />
            Доступ до: {fmt(me?.user?.accessEndsAt)}
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
          <div style={S.cardSub}>
            После оплаты нажми «Обновить» чтобы активировать доступ.
          </div>
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
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [fileById, setFileById] = useState({});
    const [busy, setBusy] = useState(false);
    const [adminError, setAdminError] = useState("");

    async function load() {
      try {
        const r = await api.adminTracks();
        setAdminTracks(r.tracks || []);
      } catch (e) { setAdminError(String(e.message || e)); }
    }
    useEffect(() => { load(); }, []);

    async function createTrack() {
      setBusy(true);
      try {
        await api.adminCreateTrack(title, artist);
        setTitle(""); setArtist("");
        await load();
      } catch (e) { setAdminError(String(e.message || e)); }
      finally { setBusy(false); }
    }

    async function upload(trackId) {
      const f = fileById[trackId];
      if (!f) return;
      setBusy(true);
      try { await api.adminUpload(trackId, f); await load(); }
      catch (e) { setAdminError(String(e.message || e)); }
      finally { setBusy(false); }
    }

    async function publish(trackId) {
      setBusy(true);
      try { await api.adminPublish(trackId); await load(); }
      catch (e) { setAdminError(String(e.message || e)); }
      finally { setBusy(false); }
    }

    if (!isAdmin) return (
      <div style={S.page}>
        <div style={S.empty}>Только для администратора</div>
      </div>
    );

    return (
      <div style={S.page}>
        <div style={S.sectionTitle}>Управление треками</div>

        {adminError && <div style={S.errorBox}>{adminError}</div>}

        <div style={S.card}>
          <div style={S.cardTitle}>Добавить трек</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Название" style={S.adminInput} />
          <input value={artist} onChange={(e) => setArtist(e.target.value)}
            placeholder="Артист" style={S.adminInput} />
          <button disabled={busy || !title} style={S.btnPrimary} onClick={createTrack}>
            ➕ Создать
          </button>
        </div>

        {adminTracks.map((t) => (
          <div key={t.id} style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...S.cardTitle, display: "flex", alignItems: "center", gap: 6 }}>
                  {t.title} {t.isPublished ? "✅" : "⏳"}
                </div>
                <div style={S.cardSub}>{t.artist || "—"}</div>
                {t.filePath && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4, wordBreak: "break-all" }}>{t.filePath}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <input type="file" accept="audio/*"
                  onChange={(e) => setFileById((s) => ({ ...s, [t.id]: e.target.files?.[0] }))}
                  style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                <button disabled={busy || !fileById[t.id]} style={S.btnSecondary} onClick={() => upload(t.id)}>
                  ⬆ Upload
                </button>
                <button disabled={busy || !t.filePath || t.isPublished} style={S.btnPrimary} onClick={() => publish(t.id)}>
                  🚀 Publish
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── routing ───────────────────────────────────────────────────────────────

  let page;
  if (route.startsWith("#/favorites")) page = <PageFavorites />;
  else if (route.startsWith("#/profile")) page = <PageProfile />;
  else if (route.startsWith("#/billing/return")) page = <PageBillingReturn />;
  else if (route.startsWith("#/admin")) page = <PageAdmin />;
  else page = <PageCatalog />;

  const tabs = [
    { href: "#/", icon: "🏠", label: "Каталог", match: (r) => r === "#/" || r === "" },
    { href: "#/favorites", icon: "♥", label: "Избранное", match: (r) => r.startsWith("#/favorites") },
    { href: "#/profile", icon: "👤", label: "Профиль", match: (r) => r.startsWith("#/profile") },
    ...(isAdmin ? [{ href: "#/admin", icon: "🛠", label: "Admin", match: (r) => r.startsWith("#/admin") }] : []),
  ];

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.logo}>🎧 Music</div>
          <div style={S.logoSub}>Telegram Mini App</div>
        </div>
        <div style={S.headerBtns}>
          <button style={S.btnSecondary} onClick={boot}>↺</button>
        </div>
      </div>

      {/* Page */}
      {page}

      {/* Player (sits above tab bar) */}
      <div style={{ paddingBottom: current ? 60 : 0 }}>
        <SpotifyPlayer
          ref={playerRef}
          track={current}
          audioUrl={audioUrl}
          onPrev={playPrev}
          onNext={playNext}
        />
      </div>

      {/* Tab Bar */}
      <div style={{
        ...S.tabBar,
        bottom: current ? 84 : 0,
      }}>
        {tabs.map((tab) => (
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
