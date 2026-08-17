// Background lullaby player. Plays real audio files listed in
// public/music/music.json (drop CC0/public-domain instrumental tracks there).
// Random rotation, no immediate repeat, mute remembered across visits,
// pauses when the tab is hidden. No music files bundled in code — they're
// static assets, added independently of the build.

import { useCallback, useEffect, useRef, useState } from 'react'

const base = import.meta.env.BASE_URL
const MUTE_KEY = 'bcw_music_muted'
const VOLUME = 0.5

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function useMusic() {
  const [muted, setMuted] = useState(readMuted)
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  const [tracks, setTracks] = useState<string[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastRef = useRef(-1)
  const runningRef = useRef(false)
  const gestureCleanupRef = useRef<(() => void) | null>(null)

  // load the track list once
  useEffect(() => {
    fetch(`${base}music/music.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setTracks(Array.isArray(list) ? list : []))
      .catch(() => setTracks([]))
  }, [])

  const armGesture = useCallback(() => {
    if (gestureCleanupRef.current) return
    const on = () => {
      cleanup()
      audioRef.current?.play().catch(() => {})
    }
    const cleanup = () => {
      document.removeEventListener('pointerdown', on)
      gestureCleanupRef.current = null
    }
    gestureCleanupRef.current = cleanup
    document.addEventListener('pointerdown', on, { once: true })
  }, [])

  const playNext = useCallback(() => {
    if (!runningRef.current || tracks.length === 0) return
    let i = Math.floor(Math.random() * tracks.length)
    if (tracks.length > 1 && i === lastRef.current) i = (i + 1) % tracks.length
    lastRef.current = i

    let a = audioRef.current
    if (!a) {
      a = new Audio()
      a.addEventListener('ended', () => playNext())
      audioRef.current = a
    }
    a.src = `${base}music/${tracks[i]}`
    a.muted = mutedRef.current
    a.volume = VOLUME
    const p = a.play()
    if (p) p.catch(() => armGesture()) // autoplay blocked → start on next tap
  }, [tracks, armGesture])

  // once tracks arrive, begin if we've been asked to play
  useEffect(() => {
    if (runningRef.current && tracks.length) playNext()
  }, [tracks, playNext])

  const start = useCallback(() => {
    runningRef.current = true
    playNext()
  }, [playNext])

  const stop = useCallback(() => {
    runningRef.current = false
    gestureCleanupRef.current?.()
    const a = audioRef.current
    if (a) {
      a.pause()
      a.removeAttribute('src')
      a.load()
    }
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0')
      } catch {
        // storage unavailable — stays session-only
      }
      if (audioRef.current) audioRef.current.muted = next
      return next
    })
  }, [])

  // pause when tab hidden, resume when visible (if not muted)
  useEffect(() => {
    const onVis = () => {
      const a = audioRef.current
      if (!a) return
      if (document.hidden) a.pause()
      else if (runningRef.current && !mutedRef.current) a.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return { muted, toggleMute, start, stop }
}
