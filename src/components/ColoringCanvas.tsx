import { useEffect, useRef, useState } from 'react'
import { loadRegionData, type RegionData } from '../engine/regionIndex'
import { pointerToPixel } from '../engine/coords'
import { paintRegion, repaintAll, hexToRgba } from '../engine/fill'

interface Props {
  design: { id: string; name: string }
  colors: Map<number, string>
  /** returns the hex actually applied (so magic mode stays in sync), or null for a no-op */
  onPaint: (id: number) => string | null
  onPop: () => void
  cleanSignal: number // increments to trigger the sweep animation
}

const base = import.meta.env.BASE_URL

export default function ColoringCanvas({ design, colors, onPaint, onPop, cleanSignal }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const regionRef = useRef<RegionData | null>(null)
  const fillDataRef = useRef<ImageData | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [ready, setReady] = useState(false)
  const [aspect, setAspect] = useState(1)

  const dir = `${base}designs/${design.id}`

  // load region data + set up the fill canvas
  useEffect(() => {
    let cancelled = false
    setReady(false)
    loadRegionData(`${dir}/regions.png`).then((region) => {
      if (cancelled) return
      regionRef.current = region
      setAspect(region.width / region.height)
      const canvas = canvasRef.current!
      canvas.width = region.width
      canvas.height = region.height
      const ctx = canvas.getContext('2d')!
      ctxRef.current = ctx
      const fill = ctx.createImageData(region.width, region.height)
      fillDataRef.current = fill
      repaintAll(fill, region, colors)
      ctx.putImageData(fill, 0, 0)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir])

  // external colour-map changes (undo / clean) → repaint everything
  useEffect(() => {
    if (!ready) return
    const region = regionRef.current
    const fill = fillDataRef.current
    const ctx = ctxRef.current
    if (!region || !fill || !ctx) return
    repaintAll(fill, region, colors)
    ctx.putImageData(fill, 0, 0)
  }, [colors, ready])

  // sweep animation when cleaned
  useEffect(() => {
    if (cleanSignal === 0) return
    const wrap = wrapRef.current
    if (!wrap) return
    wrap.classList.remove('sweep')
    // force reflow to restart the animation
    void wrap.offsetWidth
    wrap.classList.add('sweep')
  }, [cleanSignal])

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const region = regionRef.current
    const fill = fillDataRef.current
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!region || !fill || !ctx || !canvas) return
    const idx = pointerToPixel(e, canvas)
    if (idx == null) return
    const id = region.ids[idx]
    if (id === 0) return // tapped a line
    const hex = onPaint(id)
    if (!hex) return
    // paint immediately for snappy feel (state effect will also repaint, harmless)
    paintRegion(fill, region, id, hexToRgba(hex))
    ctx.putImageData(fill, 0, 0)
    onPop()
    bounce()
  }

  function bounce() {
    const wrap = wrapRef.current
    if (!wrap) return
    wrap.classList.remove('bounce')
    void wrap.offsetWidth
    wrap.classList.add('bounce')
  }

  return (
    <div className="canvas-wrap" ref={wrapRef} style={{ aspectRatio: String(aspect) }}>
      <canvas
        ref={canvasRef}
        className="fill-canvas"
        onPointerDown={handlePointerDown}
        style={{ opacity: ready ? 1 : 0 }}
      />
      <img className="line-img" src={`${dir}/line.png`} alt={design.name} draggable={false} />
      {!ready && <div className="canvas-loading">🎨</div>}
    </div>
  )
}
