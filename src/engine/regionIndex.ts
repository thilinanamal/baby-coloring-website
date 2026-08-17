// Builds a fast lookup from region id → the pixel offsets belonging to it,
// by reading the hidden regions.png once. Ids are encoded R + (G<<8).

export interface RegionData {
  width: number
  height: number
  /** id at each pixel (length = width*height); 0 = line (not colorable) */
  ids: Uint16Array
  /** id → flat pixel indices (into the width*height grid) */
  pixels: Map<number, Uint32Array>
}

export async function loadRegionData(regionsPngUrl: string): Promise<RegionData> {
  const img = await loadImage(regionsPngUrl)
  const width = img.naturalWidth
  const height = img.naturalHeight
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, width, height)

  const n = width * height
  const ids = new Uint16Array(n)
  const counts = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    const id = data[i * 4] + (data[i * 4 + 1] << 8)
    ids[i] = id
    if (id !== 0) counts.set(id, (counts.get(id) || 0) + 1)
  }

  // allocate typed arrays, then fill with a running cursor per id
  const pixels = new Map<number, Uint32Array>()
  const cursor = new Map<number, number>()
  for (const [id, count] of counts) {
    pixels.set(id, new Uint32Array(count))
    cursor.set(id, 0)
  }
  for (let i = 0; i < n; i++) {
    const id = ids[i]
    if (id === 0) continue
    const arr = pixels.get(id)!
    const cur = cursor.get(id)!
    arr[cur] = i
    cursor.set(id, cur + 1)
  }

  return { width, height, ids, pixels }
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
