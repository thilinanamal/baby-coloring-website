#!/usr/bin/env node
/**
 * build-music.mjs — scan public/music for audio files and write music.json,
 * the playlist the app fetches at runtime. Run after adding/removing tracks.
 *
 *   node scripts/build-music.mjs
 */
import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const musicDir = path.resolve(__dirname, '..', 'public', 'music')
const EXT = new Set(['.mp3', '.ogg', '.m4a', '.aac', '.wav'])

const files = (await readdir(musicDir).catch(() => []))
  .filter((f) => EXT.has(path.extname(f).toLowerCase()))
  .sort()

await writeFile(path.join(musicDir, 'music.json'), JSON.stringify(files, null, 2))
console.log(`✓ music.json: ${files.length} track(s) — ${files.join(', ') || 'none'}`)
