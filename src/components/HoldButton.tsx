import { useRef, useState } from 'react'

// Parent-gate "keep-on-task" hold: the action only fires after a sustained
// press (default 3s) — a toddler can't hold deliberately, a parent can.
interface Props {
  holdMs?: number
  label: string
  emoji: string
  onComplete: () => void
}

export default function HoldButton({ holdMs = 3000, label, emoji, onComplete }: Props) {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)

  function start() {
    startRef.current = performance.now()
    const tick = () => {
      const p = Math.min(1, (performance.now() - startRef.current) / holdMs)
      setProgress(p)
      if (p >= 1) {
        cancel()
        onComplete()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function cancel() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setProgress(0)
  }

  const deg = Math.round(progress * 360)

  return (
    <button
      className="ctrl-btn hold-btn"
      aria-label={label}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      style={{
        background: `conic-gradient(var(--accent) ${deg}deg, var(--panel) 0deg)`,
      }}
    >
      <span className="hold-inner">{emoji}</span>
    </button>
  )
}
