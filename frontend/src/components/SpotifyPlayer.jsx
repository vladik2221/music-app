import React, { useEffect, useRef, useState } from "react";

export default function SpotifyPlayer({ track, audioUrl, onPrev, onNext }) {

  const audioRef = useRef(null)

  const [playing,setPlaying] = useState(false)
  const [progress,setProgress] = useState(0)
  const [duration,setDuration] = useState(0)
  const [volume,setVolume] = useState(1)

  useEffect(()=>{
    if(audioRef.current){
      audioRef.current.volume = volume
    }
  },[volume])

  function toggle(){

    if(!audioRef.current) return

    if(playing){
      audioRef.current.pause()
      setPlaying(false)
    }else{
      audioRef.current.play()
      setPlaying(true)
    }

  }

  function onTimeUpdate(){

    const a = audioRef.current

    if(!a) return

    setProgress(a.currentTime)
    setDuration(a.duration)

  }

  function seek(e){

    const rect = e.target.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width

    audioRef.current.currentTime = percent * duration

  }

  function format(t){

    if(!t) return "0:00"

    const m = Math.floor(t/60)
    const s = Math.floor(t%60).toString().padStart(2,"0")

    return `${m}:${s}`

  }

  if(!track) return null

  return (

    <div className="fixed bottom-0 left-0 right-0 bg-black/90 border-t border-white/10 backdrop-blur p-4">

      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={onTimeUpdate}
        onEnded={onNext}
      />

      <div className="max-w-6xl mx-auto flex items-center gap-4">

        {/* COVER */}

        <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/10">

          {track.coverUrl ? (

            <img
              src={track.coverUrl}
              className="w-full h-full object-cover"
            />

          ) : (
            <div className="w-full h-full flex items-center justify-center">
              🎵
            </div>
          )}

        </div>

        {/* INFO */}

        <div className="min-w-0">

          <div className="text-white font-semibold truncate">
            {track.title}
          </div>

          <div className="text-white/60 text-sm truncate">
            {track.artist}
          </div>

        </div>

        {/* CONTROLS */}

        <div className="flex items-center gap-3 mx-auto">

          <button onClick={onPrev} className="text-white/70 hover:text-white">
            ⏮
          </button>

          <button
            onClick={toggle}
            className="bg-white text-black rounded-full w-10 h-10 flex items-center justify-center hover:scale-105 transition"
          >
            {playing ? "⏸" : "▶"}
          </button>

          <button onClick={onNext} className="text-white/70 hover:text-white">
            ⏭
          </button>

        </div>

        {/* VOLUME */}

        <div className="flex items-center gap-2">

          🔊

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e)=>setVolume(e.target.value)}
          />

        </div>

      </div>

      {/* PROGRESS */}

      <div className="max-w-6xl mx-auto mt-3 flex items-center gap-3 text-xs text-white/60">

        <div>{format(progress)}</div>

        <div
          className="flex-1 h-1 bg-white/20 rounded cursor-pointer"
          onClick={seek}
        >
          <div
            className="h-1 bg-green-500 rounded"
            style={{width:`${(progress/duration)*100 || 0}%`}}
          />
        </div>

        <div>{format(duration)}</div>

      </div>

    </div>

  )

}