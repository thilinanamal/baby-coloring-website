import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/gallery.css'

// A press only counts as a "tap" (open design) if the finger barely moved.
// A bigger move = the child is scrolling the gallery, so we don't open.
const TAP_SLOP = 12 // px

interface Design {
  id: string
  name: string
  w: number
  h: number
}

const base = import.meta.env.BASE_URL

export default function Gallery() {
  const [designs, setDesigns] = useState<Design[] | null>(null)
  const navigate = useNavigate()
  const startRef = useRef<{ x: number; y: number } | null>(null)

  function handleDown(e: React.PointerEvent) {
    startRef.current = { x: e.clientX, y: e.clientY }
  }

  function handleUp(e: React.PointerEvent, id: string) {
    const s = startRef.current
    startRef.current = null
    if (!s) return
    const moved = Math.hypot(e.clientX - s.x, e.clientY - s.y)
    if (moved <= TAP_SLOP) navigate(`color/${id}`) // real tap, not a scroll
  }

  useEffect(() => {
    fetch(`${base}designs/designs.json`)
      .then((r) => r.json())
      .then(setDesigns)
      .catch(() => setDesigns([]))
  }, [])

  return (
    <div className="gallery-screen">
      <div className="gallery-title" aria-hidden>
        🎨✨🖍️
      </div>
      <div className="gallery-grid">
        {designs?.map((d) => (
          <button
            key={d.id}
            className="design-card"
            aria-label={d.name}
            onPointerDown={handleDown}
            onPointerUp={(e) => handleUp(e, d.id)}
          >
            <img src={`${base}designs/${d.id}/line.png`} alt={d.name} draggable={false} />
          </button>
        ))}
        {designs && designs.length === 0 && (
          <div className="gallery-empty">No designs yet 🐣</div>
        )}
      </div>
    </div>
  )
}
