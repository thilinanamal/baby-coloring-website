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

export default function Gallery() {
  const [designs, setDesigns] = useState<Design[] | null>(null)
  const navigate = useNavigate()

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
            onClick={() => navigate(`color/${d.id}`)}
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
