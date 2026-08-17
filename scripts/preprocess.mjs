#!/usr/bin/env node
/**
 * preprocess.mjs — turn AI line-art PNG into a colorable region map.
 *
 * Pipeline:
 *   1. load + flatten onto white + grayscale
 *   2. threshold → 1-bit line mask (kills anti-alias fuzz)
 *   3. morphological close on lines (seal AI gaps): dilate then erode
 *   4. connected-components (4-conn) over fillable pixels → region ids
 *   5. drop/merge tiny regions into their largest neighbour
 *   6. mark background regions (touch the image border)
 *   7. write regions.png (id encoded R=id&255, G=(id>>8)&255, B=0)
 *   8. write meta.json + debug.png (QA tint)
 *
 * CLI:  node scripts/preprocess.mjs <input.png> <outDir> [--close=2] [--min=40] [--name="Nice Name"]
 */
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------- morphology (separable box, binary) ----------
function dilate1D(src, w, h, r, horizontal) {
  const out = new Uint8Array(src.length)
  if (horizontal) {
    for (let y = 0; y < h; y++) {
      const row = y * w
      for (let x = 0; x < w; x++) {
        let v = 0
        for (let k = -r; k <= r; k++) {
          const xx = x + k
          if (xx >= 0 && xx < w && src[row + xx]) { v = 1; break }
        }
        out[row + x] = v
      }
    }
  } else {
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let v = 0
        for (let k = -r; k <= r; k++) {
          const yy = y + k
          if (yy >= 0 && yy < h && src[yy * w + x]) { v = 1; break }
        }
        out[y * w + x] = v
      }
    }
  }
  return out
}
function erode1D(src, w, h, r, horizontal) {
  const out = new Uint8Array(src.length)
  if (horizontal) {
    for (let y = 0; y < h; y++) {
      const row = y * w
      for (let x = 0; x < w; x++) {
        let v = 1
        for (let k = -r; k <= r; k++) {
          const xx = x + k
          // out-of-bounds treated as FOREGROUND so border-touching lines are
          // not eroded away (that would open a gap where a line meets the edge)
          if (xx >= 0 && xx < w && !src[row + xx]) { v = 0; break }
        }
        out[row + x] = v
      }
    }
  } else {
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let v = 1
        for (let k = -r; k <= r; k++) {
          const yy = y + k
          if (yy >= 0 && yy < h && !src[yy * w + x]) { v = 0; break }
        }
        out[y * w + x] = v
      }
    }
  }
  return out
}
const dilate = (m, w, h, r) => dilate1D(dilate1D(m, w, h, r, true), w, h, r, false)
const erode = (m, w, h, r) => erode1D(erode1D(m, w, h, r, true), w, h, r, false)

// ---------- union-find for tiny-region merging ----------
function makeUF(n) {
  const p = new Int32Array(n)
  for (let i = 0; i < n; i++) p[i] = i
  const find = (i) => { while (p[i] !== i) { p[i] = p[p[i]]; i = p[i] } return i }
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) p[ra] = rb }
  return { find, union }
}

export async function processImage(inputPath, outDir, opts = {}) {
  const close = opts.close ?? 2
  const minArea = opts.min ?? 40
  const threshold = opts.threshold ?? 128
  const name = opts.name ?? path.basename(outDir)
  const maxDim = opts.maxDim ?? 1024 // cap resolution — plenty crisp on phones, far faster
  const thumbDim = opts.thumbDim ?? 320 // gallery thumbnail size

  // 1. load, cap resolution, flatten onto white, grayscale, raw bytes
  const { data, info } = await sharp(inputPath)
    .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  const n = w * h

  // 2. threshold → line mask (1 = line/dark)
  let line = new Uint8Array(n)
  for (let i = 0; i < n; i++) line[i] = data[i * info.channels] < threshold ? 1 : 0

  // 3. morphological close (dilate then erode) to seal gaps
  if (close > 0) line = erode(dilate(line, w, h, close), w, h, close)

  // 4. connected components over fillable pixels (line === 0), 4-connectivity
  const labels = new Int32Array(n).fill(-1)
  const stack = new Int32Array(n)
  let nextId = 1
  for (let start = 0; start < n; start++) {
    if (line[start] || labels[start] !== -1) continue
    const id = nextId++
    let sp = 0
    stack[sp++] = start
    labels[start] = id
    while (sp > 0) {
      const p = stack[--sp]
      const x = p % w
      const y = (p / w) | 0
      if (x > 0) { const q = p - 1; if (!line[q] && labels[q] === -1) { labels[q] = id; stack[sp++] = q } }
      if (x < w - 1) { const q = p + 1; if (!line[q] && labels[q] === -1) { labels[q] = id; stack[sp++] = q } }
      if (y > 0) { const q = p - w; if (!line[q] && labels[q] === -1) { labels[q] = id; stack[sp++] = q } }
      if (y < h - 1) { const q = p + w; if (!line[q] && labels[q] === -1) { labels[q] = id; stack[sp++] = q } }
    }
  }
  const regionCount = nextId - 1

  // sizes
  const size = new Int32Array(nextId)
  for (let i = 0; i < n; i++) if (labels[i] > 0) size[labels[i]]++

  // 5. merge tiny regions into their largest-boundary neighbour
  // adjacency: count shared borders between region pairs
  const adj = new Map() // id -> Map<neighbourId, sharedCount>
  const addAdj = (a, b) => {
    if (a === b) return
    let m = adj.get(a); if (!m) { m = new Map(); adj.set(a, m) }
    m.set(b, (m.get(b) || 0) + 1)
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      const a = labels[p]
      if (a <= 0) continue
      if (x < w - 1) { const b = labels[p + 1]; if (b > 0 && b !== a) { addAdj(a, b); addAdj(b, a) } }
      if (y < h - 1) { const b = labels[p + w]; if (b > 0 && b !== a) { addAdj(a, b); addAdj(b, a) } }
    }
  }
  const uf = makeUF(nextId)
  // merge small into biggest neighbour (iterate small first)
  const order = []
  for (let id = 1; id < nextId; id++) order.push(id)
  order.sort((a, b) => size[a] - size[b])
  let mergedCount = 0
  for (const id of order) {
    if (size[id] >= minArea) continue
    const neigh = adj.get(id)
    if (!neigh || neigh.size === 0) continue // island surrounded by lines: leave as-is
    let best = -1, bestScore = -1
    for (const [nid, shared] of neigh) {
      const root = uf.find(nid)
      const score = size[root] * 1e6 + shared // prefer bigger region, tiebreak on shared border
      if (score > bestScore) { bestScore = score; best = root }
    }
    if (best > 0) {
      const root = uf.find(id)
      if (root !== best) {
        size[best] += size[root]
        size[root] = 0
        uf.union(root, best)
        mergedCount++
      }
    }
  }

  // 6. compact ids to 1..K and detect background (touches border)
  const remap = new Map()
  let outId = 0
  const rootToOut = (root) => {
    let o = remap.get(root)
    if (o === undefined) { o = ++outId; remap.set(root, o) }
    return o
  }
  const finalLabels = new Int32Array(n)
  for (let i = 0; i < n; i++) {
    const l = labels[i]
    finalLabels[i] = l > 0 ? rootToOut(uf.find(l)) : 0
  }
  const backgroundIds = new Set()
  const markBorder = (i) => { const id = finalLabels[i]; if (id > 0) backgroundIds.add(id) }
  for (let x = 0; x < w; x++) { markBorder(x); markBorder((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { markBorder(y * w); markBorder(y * w + w - 1) }
  const count = outId

  // 7. write regions.png (RGBA; id → R=id&255, G=id>>8, B=0; lines → 0,0,0)
  const rgba = Buffer.alloc(n * 4)
  for (let i = 0; i < n; i++) {
    const id = finalLabels[i]
    rgba[i * 4] = id & 255
    rgba[i * 4 + 1] = (id >> 8) & 255
    rgba[i * 4 + 2] = 0
    rgba[i * 4 + 3] = 255
  }
  await mkdir(outDir, { recursive: true })
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'regions.png'))

  // display line art as line.png — TRANSPARENT fill areas so the colour layer
  // beneath shows through. Alpha comes from luminance: black lines opaque,
  // white → fully transparent, anti-aliased edges get partial alpha.
  const lineRgba = Buffer.alloc(n * 4)
  for (let i = 0; i < n; i++) {
    const gray = data[i * info.channels]
    lineRgba[i * 4] = 0
    lineRgba[i * 4 + 1] = 0
    lineRgba[i * 4 + 2] = 0
    lineRgba[i * 4 + 3] = 255 - gray
  }
  await sharp(lineRgba, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(path.join(outDir, 'line.png'))

  // thumbnail for the gallery — small, white background, fast to load
  await sharp(lineRgba, { raw: { width: w, height: h, channels: 4 } })
    .flatten({ background: '#ffffff' })
    .resize(thumbDim, thumbDim, { fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'thumb.png'))

  // 8. meta.json
  const meta = {
    name,
    id: path.basename(outDir),
    w,
    h,
    count,
    rawRegions: regionCount,
    mergedCount,
    backgroundIds: [...backgroundIds].sort((a, b) => a - b),
  }
  await writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2))

  // debug tint
  const dbg = Buffer.alloc(n * 4)
  const palette = new Map()
  const tint = (id) => {
    let c = palette.get(id)
    if (!c) {
      const hue = (id * 47) % 360
      c = hslToRgb(hue / 360, 0.65, 0.55)
      palette.set(id, c)
    }
    return c
  }
  for (let i = 0; i < n; i++) {
    const id = finalLabels[i]
    if (id === 0) { dbg[i * 4] = 20; dbg[i * 4 + 1] = 20; dbg[i * 4 + 2] = 20; dbg[i * 4 + 3] = 255; continue }
    const [r, g, b] = tint(id)
    dbg[i * 4] = r; dbg[i * 4 + 1] = g; dbg[i * 4 + 2] = b; dbg[i * 4 + 3] = 255
  }
  await sharp(dbg, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(path.join(outDir, 'debug.png'))

  return meta
}

function hslToRgb(h, s, l) {
  let r, g, b
  if (s === 0) { r = g = b = l }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

// ---------- CLI ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  const positional = args.filter((a) => !a.startsWith('--'))
  const flags = Object.fromEntries(
    args.filter((a) => a.startsWith('--')).map((a) => {
      const [k, v = 'true'] = a.slice(2).split('=')
      return [k, v]
    }),
  )
  const [input, outDir] = positional
  if (!input || !outDir) {
    console.error('usage: node scripts/preprocess.mjs <input.png> <outDir> [--close=2] [--min=40] [--name="Name"]')
    process.exit(1)
  }
  const opts = {
    close: flags.close !== undefined ? Number(flags.close) : undefined,
    min: flags.min !== undefined ? Number(flags.min) : undefined,
    threshold: flags.threshold !== undefined ? Number(flags.threshold) : undefined,
    name: flags.name,
  }
  const meta = await processImage(input, outDir, opts)
  console.log(`✓ ${meta.id}: ${meta.count} regions (${meta.rawRegions} raw, ${meta.mergedCount} merged), bg=${meta.backgroundIds.join(',') || 'none'}`)
  console.log(`  wrote line.png regions.png meta.json debug.png → ${outDir}`)
}
