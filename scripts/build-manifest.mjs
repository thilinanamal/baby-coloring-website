#!/usr/bin/env node
/**
 * build-manifest.mjs — scan public/designs/<id>/meta.json and write designs.json,
 * the gallery index the app fetches at runtime.
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const designsDir = path.resolve(__dirname, '..', 'public', 'designs')

const entries = await readdir(designsDir, { withFileTypes: true }).catch(() => [])
const designs = []
for (const e of entries) {
  if (!e.isDirectory()) continue
  const metaPath = path.join(designsDir, e.name, 'meta.json')
  try {
    await stat(metaPath)
    const meta = JSON.parse(await readFile(metaPath, 'utf8'))
    designs.push({ id: e.name, name: meta.name ?? e.name, w: meta.w, h: meta.h })
  } catch {
    // no meta.json → skip (not yet preprocessed)
  }
}
designs.sort((a, b) => a.name.localeCompare(b.name))
await writeFile(path.join(designsDir, 'designs.json'), JSON.stringify(designs, null, 2))
console.log(`✓ designs.json: ${designs.length} design(s) — ${designs.map((d) => d.id).join(', ') || 'none'}`)
