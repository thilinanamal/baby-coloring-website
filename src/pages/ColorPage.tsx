import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import ColoringCanvas from '../components/ColoringCanvas'
import Palette from '../components/Palette'
import Controls from '../components/Controls'
import { useColoringState } from '../hooks/useColoringState'
import { useSound } from '../hooks/useSound'
import { PALETTE, randomBrightHex } from '../data/palette'
import '../styles/color.css'

interface Design {
  id: string
  name: string
  w: number
  h: number
}

const base = import.meta.env.BASE_URL

export default function ColorPage() {
  const { id } = useParams<{ id: string }>()
  const [design, setDesign] = useState<Design | null | undefined>(undefined)
  const { colors, paint, undo, clean, canUndo } = useColoringState()
  const { pop, click, sweep } = useSound()

  const [activeColor, setActiveColor] = useState(PALETTE[0].hex)
  const [isMagic, setIsMagic] = useState(false)
  const [cleanSignal, setCleanSignal] = useState(0)

  useEffect(() => {
    fetch(`${base}designs/designs.json`)
      .then((r) => r.json())
      .then((list: Design[]) => setDesign(list.find((d) => d.id === id) ?? null))
      .catch(() => setDesign(null))
  }, [id])

  function handlePick(hex: string, magic: boolean) {
    click()
    if (magic) {
      setIsMagic(true)
    } else {
      setIsMagic(false)
      setActiveColor(hex)
    }
  }

  // magic → a fresh random colour per tap; otherwise the picked swatch
  function handlePaint(regionId: number): string | null {
    return paint(regionId, isMagic ? randomBrightHex() : activeColor)
  }

  function handleClean() {
    if (clean()) {
      sweep()
      setCleanSignal((n) => n + 1)
    }
  }

  if (design === undefined) return <div className="color-loading">🎨</div>
  if (design === null) return <Navigate to={base} replace />

  return (
    <div className="color-screen">
      <div className="stage">
        <ColoringCanvas
          design={design}
          colors={colors}
          onPaint={handlePaint}
          onPop={pop}
          cleanSignal={cleanSignal}
        />
      </div>
      <div className="sidebar">
        <Palette active={activeColor} isMagic={isMagic} onPick={handlePick} />
        <Controls canUndo={canUndo} onUndo={undo} onClean={handleClean} />
      </div>
    </div>
  )
}
