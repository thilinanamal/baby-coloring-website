// Synthesized toddler-friendly sound effects via Web Audio — no asset files.
// AudioContext is created lazily and resumed on first gesture (autoplay policy).

import { useCallback } from 'react'
import { getAudioContext } from '../audio/audioContext'

export function useSound() {
  const ctx = useCallback(() => getAudioContext(), [])

  const tone = useCallback(
    (freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.18, slideTo?: number) => {
      const ac = ctx()
      const t0 = ac.currentTime
      const osc = ac.createOscillator()
      const g = ac.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, t0)
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      osc.connect(g).connect(ac.destination)
      osc.start(t0)
      osc.stop(t0 + dur + 0.02)
    },
    [ctx],
  )

  // satisfying "pop" when a region gets filled
  const pop = useCallback(() => tone(420, 0.16, 'sine', 0.22, 760), [tone])
  // light "click" when a colour is picked
  const click = useCallback(() => tone(880, 0.07, 'triangle', 0.14), [tone])
  // soft downward "sweep" when the canvas is cleaned
  const sweep = useCallback(() => tone(660, 0.34, 'sine', 0.16, 180), [tone])

  return { pop, click, sweep }
}
