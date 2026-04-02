import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";

// ── SVG Icons (Spotify-style) ─────────────────────────────────────────────

function IconPrev() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
    </svg>
  );
}

function IconNext() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 3.9V8.1L8.5 12zM16 6h2v12h-2z"/>
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  );
}

function IconShuffle({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "#1db954" : "currentColor"}>
      <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
    </svg>
  );
}

function IconRepeat({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "#1db954" : "currentColor"}>
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ animation: "spin 1s linear infinite" }}>
      <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
    </svg>
  );
}

// ── SeekBar — нативный range input, браузер сам обрабатывает drag ────────────

const seekBarCss = `
  .seekbar { -webkit-appearance: none; appearance: none; width: 100%;
    background: transparent; cursor: pointer; outline: none; border: none;
    padding: 8px 0; margin: 0; }
  .seekbar::-webkit-slider-runnable-track {
    height: 4px; border-radius: 4px;
    background: linear-gradient(to right, #1db954 var(--pct, 0%), rgba(255,255,255,0.15) var(--pct, 0%));
  }
  .seekbar.mini::-webkit-slider-runnable-track { height: 2px; }
  .seekbar::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 14px; height: 14px; border-radius: 50%;
    background: #fff; margin-top: -5px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.5);
    transition: transform 0.15s;
  }
  .seekbar.mini::-webkit-slider-thumb { width: 0; height: 0; margin-top: -1px; }
  .seekbar:active::-webkit-slider-thumb { transform: scale(1.3); }
  .seekbar::-moz-range-track { height: 4px; border-radius: 4px; background: rgba(255,255,255,0.15); }
  .seekbar.mini::-moz-range-track { height: 2px; }
  .seekbar::-moz-range-progress { background: #1db954; height: 4px; border-radius: 4px; }
  .seekbar::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: none; }
  .seekbar.mini::-moz-range-thumb { width: 0; height: 0; }
`;

const ProgressBar = React.memo(function ProgressBar({ progress, duration, thick, onSeek, onDragStart, onDragEnd }) {
  const pct = duration ? (progress / duration) * 100 : 0;

  return (
    <>
      <style>{seekBarCss}</style>
      <input
        type="range"
        className={thick ? "seekbar" : "seekbar mini"}
        min={0}
        max={duration || 100}
        step={0.1}
        value={progress}
        style={{ "--pct": `${pct}%` }}
        onChange={(e) => onSeek(parseFloat(e.target.value))}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        onMouseUp={onDragEnd}
        onTouchEnd={onDragEnd}
      />
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────

const SpotifyPlayer = forwardRef(function SpotifyPlayer(
  { track, audioUrl, onPrev, onNext, onPlay },
  ref
) {
  const audioRef = useRef(null);
  const isDragging = useRef(false); // блокирует onTimeUpdate во время drag
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  useImperativeHandle(ref, () => ({
    play: () => { audioRef.current?.play(); setPlaying(true); },
  }));

  // Reset only when audioUrl changes — NOT when expanded changes
  useEffect(() => {
    if (!audioUrl) return;
    setProgress(0);
    setDuration(0);
    setPlaying(false);
    setLoading(true);
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = 1;
  }, []);

  // ── Media Session API — управление с экрана блокировки ───────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator) || !track) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || "Неизвестный трек",
      artist: track.artist || "Неизвестный артист",
      artwork: track.coverUrl
        ? [{ src: track.coverUrl, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });

    navigator.mediaSession.setActionHandler("play", () => {
      audioRef.current?.play();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current?.pause();
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      onPrev();
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      onNext();
    });
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (audioRef.current && details.seekTime != null) {
        audioRef.current.currentTime = details.seekTime;
      }
    });

    return () => {
      ["play", "pause", "previoustrack", "nexttrack", "seekto"].forEach(action => {
        try { navigator.mediaSession.setActionHandler(action, null); } catch {}
      });
    };
  }, [track, onPrev, onNext]);

  // Обновляем позицию трека для прогресс-бара на экране блокировки
  useEffect(() => {
    if (!("mediaSession" in navigator) || !duration) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: progress,
      });
    } catch {}
  }, [progress, duration]);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      if (!audioUrl) {
        onPlay && onPlay(track);
      } else {
        audioRef.current.play();
      }
    }
  }

  function onCanPlay() {
    setLoading(false);
    audioRef.current?.play();
  }

  function onTimeUpdate() {
    const a = audioRef.current;
    if (!a || isDragging.current) return; // не трогаем DOM пока пользователь тянет
    setProgress(a.currentTime);
    setDuration(a.duration || 0);
  }

  function onEnded() {
    if (repeat && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      onNext();
    }
  }

  const onSeek = useCallback((val) => {
    if (audioRef.current) audioRef.current.currentTime = val;
    setProgress(val);
  }, []);

  const onDragStart = useCallback(() => { isDragging.current = true; }, []);
  const onDragEnd = useCallback(() => { isDragging.current = false; }, []);

  function fmt(t) {
    if (!t || isNaN(t)) return "0:00";
    return `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;
  }

  if (!track) return null;

  function IconBtn({ onClick, children, color = "rgba(255,255,255,0.7)", stopProp = false, size = 40 }) {
    return (
      <button
        onClick={stopProp ? (e) => { e.stopPropagation(); onClick(e); } : onClick}
        style={{ background: "none", border: "none", color, cursor: "pointer", padding: 0,
          width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: "50%", flexShrink: 0 }}
      >{children}</button>
    );
  }

  // ── Single audio element — always rendered, never unmounted ───────────────
  const audioEl = (
    <audio
      key="player-audio"
      ref={audioRef}
      src={audioUrl}
      onTimeUpdate={onTimeUpdate}
      onCanPlay={onCanPlay}
      onEnded={onEnded}
      onPause={() => setPlaying(false)}
      onPlay={() => setPlaying(true)}
      style={{ display: "none" }}
    />
  );

  // ── FULLSCREEN ────────────────────────────────────────────────────────────
  const fullscreen = expanded && (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", flexDirection: "column",
      paddingBottom: "env(safe-area-inset-bottom)",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes glow { 0%,100% { box-shadow: 0 20px 60px rgba(29,185,84,0.3), 0 8px 32px rgba(0,0,0,0.6); }
          50% { box-shadow: 0 28px 80px rgba(29,185,84,0.5), 0 8px 32px rgba(0,0,0,0.6); } }
      `}</style>

      {/* Blurred bg */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        background: track.coverUrl ? "transparent" : "linear-gradient(180deg,#1a1a2e,#0a0a0a)",
      }}>
        {track.coverUrl && (
          <img src={track.coverUrl} alt="" style={{
            width: "100%", height: "100%", objectFit: "cover",
            filter: "blur(48px) brightness(0.25)", transform: "scale(1.3)",
          }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.7) 100%)" }} />
      </div>

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column", flex: 1,
        padding: "0 28px",
        animation: "fadeUp 0.28s cubic-bezier(0.32,0.72,0,1)",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, marginBottom: 4 }}>
          <IconBtn onClick={() => setExpanded(false)} color="rgba(255,255,255,0.8)">
            <IconChevronDown />
          </IconBtn>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1.5, textTransform: "uppercase" }}>
            Сейчас играет
          </div>
          <div style={{ width: 40 }} />
        </div>

        {/* Cover */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 0" }}>
          <div style={{
            width: "min(76vw, 320px)", height: "min(76vw, 320px)",
            borderRadius: 18, overflow: "hidden",
            background: "rgba(255,255,255,0.07)",
            animation: playing && !loading ? "glow 3s ease-in-out infinite" : "none",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            transform: playing && !loading ? "scale(1.03)" : "scale(0.96)",
            transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            {track.coverUrl
              ? <img src={track.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72 }}>🎵</div>
            }
          </div>
        </div>

        {/* Info */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: -0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
            {track.title}
          </div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {track.artist || "—"}
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 4 }}>
          <ProgressBar progress={progress} duration={duration} thick onSeek={onSeek} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{fmt(progress)}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{fmt(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingTop: 4 }}>
          <IconBtn onClick={() => setShuffle(s => !s)} color={shuffle ? "#1db954" : "rgba(255,255,255,0.45)"}>
            <IconShuffle active={shuffle} />
          </IconBtn>

          <IconBtn onClick={onPrev} color="rgba(255,255,255,0.9)" size={48}>
            <IconPrev />
          </IconBtn>

          <button
            onClick={toggle}
            style={{
              background: "#1db954", border: "none", borderRadius: "50%",
              width: 66, height: 66, cursor: "pointer", color: "#000",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 24px rgba(29,185,84,0.45)",
              transition: "transform 0.1s, background 0.15s",
              flexShrink: 0,
            }}
          >
            {loading ? <IconSpinner /> : playing ? <IconPause /> : <IconPlay />}
          </button>

          <IconBtn onClick={onNext} color="rgba(255,255,255,0.9)" size={48}>
            <IconNext />
          </IconBtn>

          <IconBtn onClick={() => setRepeat(r => !r)} color={repeat ? "#1db954" : "rgba(255,255,255,0.45)"}>
            <IconRepeat active={repeat} />
          </IconBtn>
        </div>

      </div>
    </div>
  );

  // ── MINI BAR ─────────────────────────────────────────────────────────────
  const miniBar = (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(12,12,12,0.97)",
      borderTop: "1px solid rgba(255,255,255,0.07)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      <ProgressBar progress={progress} duration={duration} onSeek={onSeek} onDragStart={onDragStart} onDragEnd={onDragEnd} />
      <div
        onClick={() => setExpanded(true)}
        style={{ maxWidth: 600, margin: "0 auto", padding: "9px 14px 11px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
      >
        {/* Cover */}
        <div style={{ width: 42, height: 42, borderRadius: 7, overflow: "hidden", background: "rgba(255,255,255,0.08)", flexShrink: 0 }}>
          {track.coverUrl
            ? <img src={track.coverUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎵</div>
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.artist || "—"}</div>
        </div>

        {/* Mini controls */}
        <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <IconBtn onClick={onPrev} color="rgba(255,255,255,0.6)" size={36}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
          </IconBtn>
          <button
            onClick={toggle}
            style={{ background: "#1db954", border: "none", borderRadius: "50%", width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#000", flexShrink: 0 }}
          >
            {loading ? <IconSpinner /> : playing
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            }
          </button>
          <IconBtn onClick={onNext} color="rgba(255,255,255,0.6)" size={36}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 3.9V8.1L8.5 12zM16 6h2v12h-2z"/></svg>
          </IconBtn>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Audio always lives here — never unmounts when expanded changes */}
      {audioEl}
      {fullscreen}
      {!expanded && miniBar}
    </>
  );
});

export default SpotifyPlayer;
