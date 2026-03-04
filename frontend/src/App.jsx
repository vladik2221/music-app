import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, fetchStreamBlobUrl, login, tg, getToken } from "./api.js";
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

function fmt(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return String(dt);
  }
}

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function Icon({ children, className = "" }) {
  return (
    <span className={cn("inline-flex items-center justify-center", className)}>
      {children}
    </span>
  );
}

export default function App() {
  const route = useHashRoute();

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState(null);

  const [tracks, setTracks] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [q, setQ] = useState("");

  const [current, setCurrent] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const audioRef = useRef(null);

  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  const [error, setError] = useState("");

  const isFav = useMemo(() => new Set(favorites.map((t) => t.id)), [favorites]);
  const isAdmin = me?.user?.role === "admin";

  async function boot() {
    setError("");
    try {
      if (!getToken()) await login();
      const m = await api.me();
      setMe(m);

      const t = await api.tracks("");
      setTracks(t.tracks || []);
      setQueue(t.tracks || []);
      setQueueIndex(-1);

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

  useEffect(() => {
    boot();
  }, []);

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
      setTimeout(() => audioRef.current?.play?.(), 50);
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
    if (queueIndex < 0) return;
    if (queueIndex >= queue.length - 1) return;
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
    const m = await api.trialStart();
    setMe(m);
  }

  async function subscribe() {
    const p = await api.createPayment();
    if (p.confirmationUrl) window.location.href = p.confirmationUrl;
  }

  function SidebarLink({ href, active, children }) {
    return (
      <a
        href={href}
        className={cn(
          "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
          active
            ? "bg-white/10 text-white"
            : "text-white/70 hover:bg-white/5 hover:text-white",
        )}
      >
        {children}
      </a>
    );
  }

  function TopBar() {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="text-white">
          <div className="text-lg font-semibold tracking-tight">🎧 Music</div>
          <div className="text-xs text-white/60">Telegram Mini App</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={startTrial}
            className="rounded-xl bg-emerald-500/90 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Trial
          </button>
          <button
            onClick={subscribe}
            className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90"
          >
            Подписка
          </button>
          <button
            onClick={boot}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
          >
            Обновить
          </button>
        </div>
      </div>
    );
  }

  function StatPill({ label, value }) {
    return (
      <div className="rounded-xl bg-white/5 px-3 py-2">
        <div className="text-[11px] uppercase tracking-wide text-white/50">
          {label}
        </div>
        <div className="text-sm font-medium text-white">{value}</div>
      </div>
    );
  }

  function HeaderCards() {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <StatPill
          label="Пользователь"
          value={
            me?.user?.firstName ||
            me?.user?.username ||
            me?.user?.telegramId ||
            "—"
          }
        />
        <StatPill label="Роль" value={me?.user?.role || "—"} />
        <StatPill
          label="Доступ"
          value={me?.accessActive ? "✅ активен" : "❌ нет"}
        />
        <div className="md:col-span-3 rounded-2xl bg-white/5 p-3 text-xs text-white/60">
          trialEndsAt: {fmt(me?.user?.trialEndsAt)} <br />
          accessEndsAt: {fmt(me?.user?.accessEndsAt)}
        </div>
      </div>
    );
  }

  function TrackCard({ t, idx, list, onPlay, onToggleFav, fav }) {
    return (
      <div className="group rounded-2xl bg-white/5 p-3 hover:bg-white/10 transition">
        {/* cover */}
        <div className="relative aspect-square overflow-hidden rounded-xl bg-white/10">
          {t.coverUrl ? (
            <img
              src={
                t.coverUrl.startsWith("http")
                  ? t.coverUrl
                  : import.meta.env.VITE_API_BASE_URL + t.coverUrl
              }
              className="h-full w-full object-cover"
              alt={t.title}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl text-white/60">
              🎵
            </div>
          )}

          {/* play button overlay */}
          <button
            onClick={() => onPlay(t, list, idx)}
            className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition
                     rounded-full bg-[var(--accent)] text-black w-12 h-12 flex items-center justify-center shadow-lg"
            title="Play"
          >
            ▶
          </button>
        </div>

        {/* title/artist */}
        <div className="mt-3 min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {t.title}
          </div>
          <div className="truncate text-xs text-white/60">
            {t.artist || "—"}
          </div>
        </div>

        {/* actions */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => onToggleFav(t.id)}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
            title="Favorite"
          >
            {fav ? "💚" : "🤍"}
          </button>

          <div className="text-xs text-white/40">#{idx + 1}</div>
        </div>
      </div>
    );
  }

  function Catalog() {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-white/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск: название или артист"
              className="w-full flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20 md:w-auto"
            />
            <button
              onClick={doSearch}
              className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              Поиск
            </button>
            <button
              onClick={async () => {
                setQ("");
                const t = await api.tracks("");
                setTracks(t.tracks || []);
                setQueue(t.tracks || []);
                setQueueIndex(-1);
              }}
              className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
            >
              Сброс
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {tracks.map((t, idx) => (
            <TrackCard
              key={t.id}
              t={t}
              idx={idx}
              list={tracks}
              onPlay={play}
              onToggleFav={toggleFav}
              fav={isFav.has(t.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  function Favorites() {
    return (
      <div className="space-y-3">
        {favorites.length === 0 ? (
          <div className="rounded-2xl bg-white/5 p-4 text-sm text-white/70">
            Пока пусто
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {favorites.map((t, idx) => (
            <TrackCard
              key={t.id}
              t={t}
              idx={idx}
              list={favorites}
              onPlay={play}
              onToggleFav={toggleFav}
              fav={isFav.has(t.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  function Profile() {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-white/5 p-4 text-white">
          <div className="text-sm font-semibold">Профиль</div>
          <div className="mt-2 text-xs text-white/60">
            Тут легко расширить: история платежей, настройки, тарифы, промокоды.
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 p-4 text-white">
          <div className="text-sm font-semibold">Оплата</div>
          <div className="mt-2 text-xs text-white/60">
            ЮKassa возвращает на{" "}
            <code className="rounded bg-black/40 px-1 py-0.5">
              #/billing/return
            </code>
            . Доступ активируется после webhook. Затем нажми «Обновить».
          </div>
          <div className="mt-3">
            <a
              className="text-sm text-emerald-300 hover:underline"
              href="#/billing/return"
            >
              Перейти на return
            </a>
          </div>
        </div>
      </div>
    );
  }

  function BillingReturn() {
    return (
      <div className="rounded-2xl bg-white/5 p-4 text-white">
        <div className="text-sm font-semibold">Возврат после оплаты</div>
        <div className="mt-2 text-xs text-white/60">
          Нажми кнопку ниже, чтобы обновить статус доступа.
        </div>
        <div className="mt-3">
          <button
            onClick={boot}
            className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90"
          >
            Проверить доступ
          </button>
        </div>
      </div>
    );
  }

  function Admin() {
    const [adminTracks, setAdminTracks] = useState([]);
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [fileById, setFileById] = useState({});
    const [busy, setBusy] = useState(false);

    async function load() {
      const r = await api.adminTracks();
      setAdminTracks(r.tracks || []);
    }
    useEffect(() => {
      load();
    }, []);

    async function createTrack() {
      setBusy(true);
      try {
        await api.adminCreateTrack(title, artist);
        setTitle("");
        setArtist("");
        await load();
      } finally {
        setBusy(false);
      }
    }

    async function upload(trackId) {
      const f = fileById[trackId];
      if (!f) return;
      setBusy(true);
      try {
        await api.adminUpload(trackId, f);
        await load();
      } finally {
        setBusy(false);
      }
    }

    async function publish(trackId) {
      setBusy(true);
      try {
        await api.adminPublish(trackId);
        await load();
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-white/5 p-4 text-white">
          <div className="text-sm font-semibold">
            Admin — управление треками
          </div>
          <div className="mt-3 grid gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название"
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            />
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Артист"
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            />
            <button
              disabled={busy || !title}
              onClick={createTrack}
              className="rounded-xl bg-emerald-500/90 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
            >
              ➕ Создать трек
            </button>
          </div>
        </div>

        {adminTracks.map((t) => (
          <div key={t.id} className="rounded-2xl bg-white/5 p-4 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {t.title}{" "}
                  <span className="text-white/60">
                    {t.isPublished ? "✅" : "⏳"}
                  </span>
                </div>
                <div className="truncate text-xs text-white/60">
                  {t.artist || "—"}
                </div>
                <div className="mt-1 break-all text-[11px] text-white/50">
                  file: {t.filePath || "—"}
                </div>
              </div>

              <div className="grid gap-2">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) =>
                    setFileById((s) => ({ ...s, [t.id]: e.target.files?.[0] }))
                  }
                  className="text-xs text-white/70"
                />
                <button
                  disabled={busy || !fileById[t.id]}
                  onClick={() => upload(t.id)}
                  className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                >
                  ⬆ Upload
                </button>
                <button
                  disabled={busy || !t.filePath || t.isPublished}
                  onClick={() => publish(t.id)}
                  className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-50"
                >
                  🚀 Publish
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  let content = null;
  if (route.startsWith("#/favorites")) content = <Favorites />;
  else if (route.startsWith("#/profile")) content = <Profile />;
  else if (route.startsWith("#/billing/return")) content = <BillingReturn />;
  else if (route.startsWith("#/admin"))
    content = isAdmin ? (
      <Admin />
    ) : (
      <div className="rounded-2xl bg-white/5 p-4 text-white/70">
        Только для админа
      </div>
    );
  else content = <Catalog />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 pb-28 pt-4 md:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside className="rounded-3xl bg-white/5 p-3 md:sticky md:top-4 md:h-[calc(100vh-2rem)]">
          <div className="mb-3 rounded-2xl bg-white/5 px-3 py-3">
            <div className="text-sm font-semibold text-white">Навигация</div>
            <div className="mt-1 text-xs text-white/60">
              Как Spotify, только в Telegram
            </div>
          </div>

          <div className="space-y-1">
            <SidebarLink href="#/" active={route === "#/" || route === ""}>
              <Icon>🏠</Icon> Каталог
            </SidebarLink>
            <SidebarLink
              href="#/favorites"
              active={route.startsWith("#/favorites")}
            >
              <Icon>💚</Icon> Избранное
            </SidebarLink>
            <SidebarLink
              href="#/profile"
              active={route.startsWith("#/profile")}
            >
              <Icon>👤</Icon> Профиль
            </SidebarLink>
            {isAdmin && (
              <SidebarLink href="#/admin" active={route.startsWith("#/admin")}>
                <Icon>🛠</Icon> Admin
              </SidebarLink>
            )}
          </div>

          {error ? (
            <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              {error}
            </div>
          ) : null}

          {!ready ? (
            <div className="mt-3 rounded-2xl bg-white/5 p-3 text-xs text-white/70">
              Открой Mini App внутри Telegram (нужен initData). Если в браузере
              — будет ошибка.
              <div className="mt-2">
                <button
                  onClick={boot}
                  className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90"
                >
                  Попробовать снова
                </button>
              </div>
            </div>
          ) : null}
        </aside>

        {/* Main */}
        <main className="space-y-4 rounded-3xl bg-white/5 p-4">
          <TopBar />
          {ready ? <HeaderCards /> : null}
          <div className="h-px bg-white/10" />
          {ready ? content : null}
        </main>
      </div>

      <SpotifyPlayer
        track={current}
        audioUrl={audioUrl}
        onPrev={playPrev}
        onNext={playNext}
      />
    </div>
  );
}
