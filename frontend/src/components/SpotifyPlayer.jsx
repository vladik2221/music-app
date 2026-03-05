import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

const SpotifyPlayer = forwardRef(function SpotifyPlayer(
  { track, audioUrl, onPrev, onNext },
  ref
) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [loading, setLoading] = useState(false);

  // Expose play() to parent
  useImperativeHandle(ref, () => ({
    play: () => {
      audioRef.current?.play();
      setPlaying(true);
    },
  }));

  // Reset state when new track url arrives
  useEffect(() => {
    if (!audioUrl) return;
    setProgress(0);
    setDuration(0);
    setPlaying(false);
    setLoading(true);
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
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

  function seek(e) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = percent * duration;
  }

  function fmt(t) {
    if (!t || isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  if (!track) return null;

  const pct = duration ? (progress / duration) * 100 : 0;

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      background: "rgba(10,10,10,0.97)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={onTimeUpdate}
        onCanPlay={onCanPlay}
        onEnded={onNext}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

      {/* Progress bar */}
      <div
        onClick={seek}
        style={{
          height: 3,
          background: "rgba(255,255,255,0.12)",
          cursor: "pointer",
        }}
      >
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: "linear-gradient(90deg, #1db954, #1ed760)",
          transition: "width 0.1s linear",
        }} />
      </div>

      <div style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: "10px 16px 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        {/* Cover */}
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          overflow: "hidden",
          background: "rgba(255,255,255,0.08)",
          flexShrink: 0,
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
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, flexShrink: 0 }}>
          {fmt(progress)} / {fmt(duration)}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            onClick={onPrev}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 18, cursor: "pointer", padding: 4 }}
          >⏮</button>

          <button
            onClick={toggle}
            style={{
              background: loading ? "rgba(255,255,255,0.15)" : "#1db954",
              border: "none",
              borderRadius: "50%",
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: loading ? "default" : "pointer",
              fontSize: 15,
              color: "#000",
              transition: "background 0.2s",
            }}
          >
            {loading ? "⏳" : playing ? "⏸" : "▶"}
          </button>

          <button
            onClick={onNext}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 18, cursor: "pointer", padding: 4 }}
          >⏭</button>
        </div>
      </div>
    </div>
  );
});

export default SpotifyPlayer;
