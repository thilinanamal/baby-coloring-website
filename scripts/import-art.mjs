#!/usr/bin/env node
/**
 * import-art.mjs — batch-process every image in a folder into colorable designs.
 *
 *   node scripts/import-art.mjs <folder> [--close=2] [--min=60]
 *
 * Each image file → public/designs/<slug>/ (line.png, regions.png, meta.json,
 * debug.png). Filename becomes the display name; a kebab-case slug becomes the id.
 * Supports .png .jpg .jpeg .webp. Runs build-manifest at the end.
 */
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { processImage } from './preprocess.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const folder = args.find((a) => !a.startsWith('--'))
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, v = 'true'] = a.slice(2).split('=')
    return [k, v]
  }),
)
if (!folder) {
  console.error('usage: node scripts/import-art.mjs <folder> [--close=2] [--min=60]')
  process.exit(1)
}

const close = flags.close !== undefined ? Number(flags.close) : 2
const min = flags.min !== undefined ? Number(flags.min) : 60
const EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
const titleCase = (s) =>
  s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase())

const files = (await readdir(folder)).filter((f) => EXT.has(path.extname(f).toLowerCase()))
if (files.length === 0) {
  console.error(`No images (.png/.jpg/.jpeg/.webp) found in ${folder}`)
  process.exit(1)
}

console.log(`Processing ${files.length} image(s) from ${folder}\n`)
for (const file of files.sort()) {
  const stem = path.basename(file, path.extname(file))
  const id = slugify(stem)
  const name = titleCase(stem)
  const outDir = path.join(root, 'public', 'designs', id)
  try {
    const meta = await processImage(path.join(folder, file), outDir, { close, min, name })
    console.log(`✓ ${file}  →  ${id}  (${meta.count} regions, ${meta.mergedCount} merged, bg=${meta.backgroundIds.join(',') || 'none'})`)
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`)
  }
}

console.log('')
await import('./build-manifest.mjs')
console.log('\nDone. Review each public/designs/<id>/debug.png, then commit & push.')
