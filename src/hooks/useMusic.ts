// In-browser music box: plays public-domain lullaby melodies with an additive
// "bell" synth. No audio files. Music sits under the tap SFX, pauses when the
// tab is hidden, and mute is remembered across visits (a device preference).

import { useCallback, useEffect, useRef, useState } from 'react'
import { getAudioContext, whenRunning } from '../audio/audioContext'
import { MELODIES, type Melody } from '../audio/melodies'

const MUTE_KEY = 'bcw_music_muted'
const MUSIC_LEVEL = 0.13
const GAP_BEATS = 4 // silence between repeats
const REPEATS = 2 // times a melody loops before switching

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

  const busRef = useRef<GainNode | null>(null) // master music gain (mute/pause act here)
  const oscsRef = useRef<OscillatorNode[]>([])
  const timerRef = useRef<number | null>(null)
  const cleanupGateRef = useRef<(() => void) | null>(null)
  const lastIdxRef = useRef(-1)
  const runningRef = useRef(false)

  const buildGraph = useCallback(() => {
    const ctx = getAudioContext()
    if (busRef.current) return busRef.current
    const bus = ctx.createGain()
    bus.gain.value = mutedRef.current ? 0 : MUSIC_LEVEL
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2200
    bus.connect(lp).connect(ctx.destination)
    busRef.current = bus
    return bus
  }, [])

  // one bell note = 3 decaying partials through the music bus
  const playBell = useCallback((freq: number, start: number, dur: number) => {
    const ctx = getAudioContext()
    const bus = buildGraph()
    const partials: [number, number][] = [
      [1, 1.0],
      [2, 0.4],
      [3, 0.14],
    ]
    for (const [mult, g] of partials) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq * mult * (1 + (Math.random() - 0.5) * 0.002) // tiny detune
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, start)
      env.gain.exponentialRampToValueAtTime(g, start + 0.006)
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(env).connect(bus)
      osc.start(start)
      osc.stop(start + dur + 0.05)
      oscsRef.current.push(osc)
      osc.onended = () => {
        oscsRef.current = oscsRef.current.filter((o) => o !== osc)
      }
    }
  }, [buildGraph])

  const scheduleMelody = useCallback(
    (melody: Melody, transpose: number, tempoMul: number, startAt: number): number => {
      const beat = 60 / (melody.bpm * tempoMul)
      const ratio = Math.pow(2, transpose / 12)
      let t = startAt
      for (const note of melody.notes) {
        const dur = note.beats * beat
        if (note.freq > 0) playBell(note.freq * ratio, t, dur * 0.95)
        t += dur
      }
      return t - startAt
    },
    [playBell],
  )

  const loop = useCallback(() => {
    if (!runningRef.current) return
    const ctx = getAudioContext()
    // pick a melody, avoid immediate repeat
    let idx = Math.floor(Math.random() * MELODIES.length)
    if (MELODIES.length > 1 && idx === lastIdxRef.current) idx = (idx + 1) % MELODIES.length
    lastIdxRef.current = idx
    const melody = MELODIES[idx]
    const transpose = Math.floor(Math.random() * 5) - 2 // -2..+2 semitones
    const tempoMul = 0.96 + Math.random() * 0.08 // subtle tempo drift

    const beat = 60 / (melody.bpm * tempoMul)
    let cursor = ctx.currentTime + 0.15
    let total = 0
    for (let r = 0; r < REPEATS; r++) {
      const dur = scheduleMelody(melody, transpose, tempoMul, cursor + total)
      total += dur + GAP_BEATS * beat
    }
    // schedule the next batch just before this one ends
    timerRef.current = window.setTimeout(loop, Math.max(1000, (total - 0.5) * 1000))
  }, [scheduleMelody])

  const start = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    cleanupGateRef.current = whenRunning(() => {
      buildGraph()
      loop()
    })
  }, [buildGraph, loop])

  const stop = useCallback(() => {
    runningRef.current = false
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    cleanupGateRef.current?.()
    cleanupGateRef.current = null
    for (const o of oscsRef.current) {
      try {
        o.stop()
      } catch {
        // already stopped
      }
    }
    oscsRef.current = []
    if (busRef.current) {
      try {
        busRef.current.disconnect()
      } catch {
        // noop
      }
      busRef.current = null
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
      const bus = busRef.current
      if (bus) {
        const ctx = getAudioContext()
        bus.gain.cancelScheduledValues(ctx.currentTime)
        bus.gain.linearRampToValueAtTime(next ? 0 : MUSIC_LEVEL, ctx.currentTime + 0.2)
      }
      return next
    })
  }, [])

  // pause (duck) when tab hidden, restore when visible (if not muted)
  useEffect(() => {
    const onVis = () => {
      const bus = busRef.current
      if (!bus) return
      const ctx = getAudioContext()
      const target = document.hidden || mutedRef.current ? 0 : MUSIC_LEVEL
      bus.gain.cancelScheduledValues(ctx.currentTime)
      bus.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.2)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return { muted, toggleMute, start, stop }
}
