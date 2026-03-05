import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

const SpotifyPlayer = forwardRef(function SpotifyPlayer(
  { track, audioUrl, onPrev, onNext },
  ref
) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false); // repeat one
  const dragRef = useRef(null);

  useImperativeHandle(ref, () => ({
    play: () => { audioRef.current?.play(); setPlaying(true); },
  }));

  useEffect(() => {
    if (!audioUrl) return;
    setProgress(0); setDuration(0); setPlaying(false); setLoading(true);
  }, [audioUrl]);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }

  function onCanPlay() {
    setLoading(false);
    audioRef.current?.play();
    setPlaying(true);
  }

  function onTimeUpdate() {
    const a = audioRef.current;
    if (!a) return;
    setProgress(a.currentTime);
    setDuration(a.duration || 0);
  }

  function onEnded() {
    if (repeat) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      onNext();
    }
  }

  // Seek — works with both click and touch
  function seekFromEvent(e, el) {
    if (!duration) return;
    const rect = el.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audioRef.current.currentTime = percent * duration;
  }

  function handleSeekClick(e) { seekFromEvent(e, e.currentTarget); }

  // Touch drag on progress bar
  function handleSeekTouchMove(e) {
    e.preventDefault();
    seekFromEvent(e, e.currentTarget);
  }

  function fmt(t) {
    if (!t || isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  if (!track) return null;

  const pct = duration ? (progress / duration) * 100 : 0;

  // ── Shared audio element ─────────────────────────────────────────────────
  const audioEl = (
    <audio
      ref={audioRef}
      src={audioUrl}
      onTimeUpdate={onTimeUpdate}
      onCanPlay={onCanPlay}
      onEnded={onEnded}
      onPause={() => setPlaying(false)}
      onPlay={() => setPlaying(true)}
    />
  );

  // ── Progress bar (reused in both mini and full) ───────────────────────────
  function ProgressBar({ height = 3, thumbSize = 0 }) {
    return (
      <div
        onClick={handleSeekClick}
        onTouchMove={handleSeekTouchMove}
        style={{
          height: thumbSize ? height + thumbSize : height,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          position: "relative",
        }}
      >
        <div style={{
          position: "absolute", left: 0, right: 0,
          height, background: "rgba(255,255,255,0.15)", borderRadius: height,
        }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: "linear-gradient(90deg, #1db954, #1ed760)",
            borderRadius: height,
            transition: "width 0.1s linear",
            position: "relative",
          }}>
            {thumbSize > 0 && (
              <div style={{
                position: "absolute", right: -thumbSize / 2, top: "50%",
                transform: "translateY(-50%)",
                width: thumbSize, height: thumbSize,
                borderRadius: "50%", background: "#fff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              }} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── FULL SCREEN PLAYER ────────────────────────────────────────────────────
  if (expanded) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: track.coverUrl
          ? "linear-gradient(180deg, #1a1a2e 0%, #0a0a0a 60%)"
          : "linear-gradient(180deg, #0f2027 0%, #0a0a0a 60%)",
        display: "flex", flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom)",
        animation: "slideUp 0.3s ease",
        overflow: "hidden",
      }}>
        <style>{`
          @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(0.97); } }
        `}</style>

        {audioEl}

        {/* Blurred cover background */}
        {track.coverUrl && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 0,
            backgroundImage: `url(${track.coverUrl})`,
            backgroundSize: "cover", backgroundPosition: "center",
            filter: "blur(60px) brightness(0.3)",
            transform: "scale(1.2)",
          }} />
        )}

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%", padding: "0 28px" }}>

          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, marginBottom: 8 }}>
            <button
              onClick={() => setExpanded(false)}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 22, cursor: "pointer", padding: 8, lineHeight: 1 }}
            >
              ⌄
            </button>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: 1, textTransform: "uppercase" }}>
              Сейчас играет
            </div>
            <div style={{ width: 38 }} />
          </div>

          {/* Cover art */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 0" }}>
            <div style={{
              width: "min(72vw, 300px)", height: "min(72vw, 300px)",
              borderRadius: 20,
              overflow: "hidden",
              background: "rgba(255,255,255,0.07)",
              boxShadow: playing
                ? "0 24px 80px rgba(29,185,84,0.35), 0 8px 32px rgba(0,0,0,0.6)"
                : "0 16px 48px rgba(0,0,0,0.5)",
              transition: "box-shadow 0.4s ease",
              animation: playing && !loading ? "pulse 3s ease-in-out infinite" : "none",
            }}>
              {track.coverUrl ? (
                <img src={track.coverUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80 }}>🎵</div>
              )}
            </div>
          </div>

          {/* Track info */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: -0.5, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {track.title}
            </div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {track.artist || "—"}
            </div>
          </div>

          {/* Progress */}
          <div style={{ marginBottom: 8 }}>
            <ProgressBar height={4} thumbSize={14} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{fmt(progress)}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{fmt(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            {/* Shuffle */}
            <button
              onClick={() => setShuffle(s => !s)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 8, fontSize: 20, color: shuffle ? "#1db954" : "rgba(255,255,255,0.45)", position: "relative" }}
            >
              🔀
              {shuffle && <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "#1db954", display: "block" }} />}
            </button>

            {/* Prev */}
            <button
              onClick={onPrev}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 32, cursor: "pointer", padding: 8, lineHeight: 1 }}
            >⏮</button>

            {/* Play/Pause */}
            <button
              onClick={toggle}
              style={{
                background: loading ? "rgba(255,255,255,0.15)" : "#1db954",
                border: "none", borderRadius: "50%",
                width: 68, height: 68,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: loading ? "default" : "pointer",
                fontSize: 26, color: "#000",
                boxShadow: "0 8px 24px rgba(29,185,84,0.4)",
                transition: "transform 0.1s, background 0.2s",
              }}
            >
              {loading ? "⏳" : playing ? "⏸" : "▶"}
            </button>

            {/* Next */}
            <button
              onClick={onNext}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 32, cursor: "pointer", padding: 8, lineHeight: 1 }}
            >⏭</button>

            {/* Repeat */}
            <button
              onClick={() => setRepeat(r => !r)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 8, fontSize: 20, color: repeat ? "#1db954" : "rgba(255,255,255,0.45)", position: "relative" }}
            >
              🔁
              {repeat && <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "#1db954", display: "block" }} />}
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ── MINI PLAYER (bottom bar) ──────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(10,10,10,0.97)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {audioEl}

      <ProgressBar height={2} />

      <div
        onClick={() => setExpanded(true)}
        style={{
          maxWidth: 600, margin: "0 auto",
          padding: "10px 16px 12px",
          display: "flex", alignItems: "center", gap: 12,
          cursor: "pointer",
        }}
      >
        {/* Cover */}
        <div style={{
          width: 44, height: 44, borderRadius: 8,
          overflow: "hidden", background: "rgba(255,255,255,0.08)", flexShrink: 0,
        }}>
          {track.coverUrl ? (
            <img src={track.coverUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎵</div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {track.title}
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {track.artist || "—"}
          </div>
        </div>

        {/* Time */}
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, flexShrink: 0 }}>
          {fmt(progress)} / {fmt(duration)}
        </div>

        {/* Controls — stop propagation so click doesn't open fullscreen */}
        <div
          onClick={e => e.stopPropagation()}
          style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
        >
          <button onClick={onPrev} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 18, cursor: "pointer", padding: 4 }}>⏮</button>
          <button
            onClick={toggle}
            style={{
              background: loading ? "rgba(255,255,255,0.15)" : "#1db954",
              border: "none", borderRadius: "50%",
              width: 38, height: 38,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: loading ? "default" : "pointer",
              fontSize: 15, color: "#000", transition: "background 0.2s",
            }}
          >
            {loading ? "⏳" : playing ? "⏸" : "▶"}
          </button>
          <button onClick={onNext} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 18, cursor: "pointer", padding: 4 }}>⏭</button>
        </div>
      </div>
    </div>
  );
});

export default SpotifyPlayer;
