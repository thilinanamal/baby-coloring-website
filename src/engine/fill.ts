// Paint / clear a region onto the fill ImageData, and repaint a whole
// colour map from scratch (used by undo / clean).

import type { RegionData } from './regionIndex'

export interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

export function hexToRgba(hex: string): RGBA {
  // supports #rgb / #rrggbb
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const num = parseInt(h, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255, a: 255 }
}

/** Paint one region's pixels into the fill ImageData. */
export function paintRegion(fill: ImageData, region: RegionData, id: number, color: RGBA) {
  const pix = region.pixels.get(id)
  if (!pix) return
  const d = fill.data
  for (let k = 0; k < pix.length; k++) {
    const off = pix[k] * 4
    d[off] = color.r
    d[off + 1] = color.g
    d[off + 2] = color.b
    d[off + 3] = color.a
  }
}

/** Clear the whole fill layer to transparent. */
export function clearFill(fill: ImageData) {
  fill.data.fill(0)
}

/** Repaint the entire fill layer from a regionId→hexColor map. */
export function repaintAll(fill: ImageData, region: RegionData, colors: Map<number, string>) {
  clearFill(fill)
  for (const [id, hex] of colors) {
    paintRegion(fill, region, id, hexToRgba(hex))
  }
}
