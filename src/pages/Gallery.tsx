import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/gallery.css'

interface Design {
  id: string
  name: string
  w: number
  h: number
}

const base = import.meta.env.BASE_URL

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Cache the shuffled order for this page session, so navigating back to the
// gallery keeps the same order — but a reload / new visit reshuffles.
let sessionOrder: Design[] | null = null

export default function Gallery() {
  const [designs, setDesigns] = useState<Design[] | null>(sessionOrder)
  const navigate = useNavigate()

  useEffect(() => {
    if (sessionOrder) return // already loaded + shuffled this session
    fetch(`${base}designs/designs.json`)
      .then((r) => r.json())
      .then((list: Design[]) => {
        sessionOrder = shuffle(list)
        setDesigns(sessionOrder)
      })
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
            onClick={() => navigate(`color/${d.id}`)}
          >
            <img
              src={`${base}designs/${d.id}/thumb.png`}
              alt={d.name}
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          </button>
        ))}
        {designs && designs.length === 0 && (
          <div className="gallery-empty">No designs yet 🐣</div>
        )}
      </div>
    </div>
  )
}
