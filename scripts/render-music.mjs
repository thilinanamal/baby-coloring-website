#!/usr/bin/env node
/**
 * render-music.mjs — render public-domain nursery-rhyme melodies to real
 * instrument audio (Music Box) via fluidsynth + a GM soundfont, then encode
 * to small mono MP3s in public/music. Legal (PD melodies, self-rendered),
 * free, recognisable tunes.
 *
 * Requires: fluidsynth, ffmpeg, and a GM soundfont at $SF2 (or /tmp/gm.sf2).
 *   node scripts/render-music.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'public', 'music')
const tmp = os.tmpdir()
const SF2 = process.env.SF2 || path.join(tmp, 'gm.sf2')
const PROGRAM = 10 // GM Music Box
const TPQ = 480
const VEL = 82

const SEMI = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }
const midiOf = (name) => {
  if (name === 'R') return -1
  const m = name.match(/^([A-G]#?)(\d)$/)
  return (parseInt(m[2]) + 1) * 12 + SEMI[m[1]]
}
// note(name, beats)
const n = (name, beats = 1) => ({ midi: midiOf(name), beats })

// ---- melodies (quarter = 1 beat) ----
const SONGS = [
  {
    file: 'twinkle-twinkle.mp3', bpm: 108,
    seq: [
      'C4','C4','G4','G4','A4','A4','G4:2','F4','F4','E4','E4','D4','D4','C4:2',
      'G4','G4','F4','F4','E4','E4','D4:2','G4','G4','F4','F4','E4','E4','D4:2',
      'C4','C4','G4','G4','A4','A4','G4:2','F4','F4','E4','E4','D4','D4','C4:2','R:2',
    ],
  },
  {
    file: 'old-macdonald.mp3', bpm: 116,
    seq: [
      'G4','G4','G4','D4','E4','E4','D4:2','B4','B4','A4','A4','G4:2',
      'D4','G4','G4','G4','D4','E4','E4','D4:2','B4','B4','A4','A4','G4:2',
      'D4','G4:0.5','G4:0.5','G4','D4:0.5','D4:0.5','G4','G4','G4','D4:0.5','D4:0.5',
      'G4','G4','G4','D4','E4','E4','D4:2','B4','B4','A4','A4','G4:3','R:2',
    ],
  },
  {
    file: 'london-bridge.mp3', bpm: 112,
    seq: [
      'G4:1.5','A4:0.5','G4','F4','E4','F4','G4:2','D4','E4','F4:2','E4','F4','G4:2',
      'G4:1.5','A4:0.5','G4','F4','E4','F4','G4:2','D4:2','G4:2','E4:2','C4:2','R:2',
    ],
  },
  {
    file: 'mary-had-a-little-lamb.mp3', bpm: 112,
    seq: [
      'E4','D4','C4','D4','E4','E4','E4:2','D4','D4','D4:2','E4','G4','G4:2',
      'E4','D4','C4','D4','E4','E4','E4','E4','D4','D4','E4','D4','C4:3','R:2',
    ],
  },
  {
    file: 'row-row-your-boat.mp3', bpm: 104,
    seq: [
      'C4:2','C4','D4','E4:2','E4','D4','E4','F4','G4:3',
      'C5:0.5','C5:0.5','G4:0.5','G4:0.5','E4:0.5','E4:0.5','C4:0.5','C4:0.5',
      'G4','F4','E4','D4','C4:3','R:2',
    ],
  },
  {
    file: 'wheels-on-the-bus.mp3', bpm: 116,
    seq: [
      'C4','F4','F4','F4','A4','C5','A4','F4','G4:2','E4:2','C4:2',
      'C4','F4','F4','F4','A4','C5','A4','F4','G4:1.5','F4:0.5','F4:3','R:2',
    ],
  },
]

function parseSeq(seq) {
  return seq.map((tok) => {
    const [name, b] = tok.split(':')
    return n(name, b ? parseFloat(b) : 1)
  })
}

// ---- minimal Standard MIDI File (type 0) writer ----
function vlq(v) {
  const bytes = [v & 0x7f]
  v >>= 7
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80)
    v >>= 7
  }
  return bytes
}

function buildMidi(notes, bpm, repeats = 3) {
  const track = []
  // tempo meta
  const usPerQuarter = Math.round(60000000 / bpm)
  track.push(...vlq(0), 0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff)
  // program change (music box) on channel 0
  track.push(...vlq(0), 0xc0, PROGRAM)

  let delta = 0
  for (let r = 0; r < repeats; r++) {
    for (const note of notes) {
      const dur = Math.round(note.beats * TPQ)
      if (note.midi < 0) {
        delta += dur // rest
        continue
      }
      track.push(...vlq(delta), 0x90, note.midi, VEL) // note on
      track.push(...vlq(dur), 0x80, note.midi, 0) // note off after dur
      delta = 0
    }
  }
  track.push(...vlq(0), 0xff, 0x2f, 0x00) // end of track

  const header = [
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (TPQ >> 8) & 0xff, TPQ & 0xff,
  ]
  const len = track.length
  const trkHead = [0x4d, 0x54, 0x72, 0x6b, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]
  return Buffer.from([...header, ...trkHead, ...track])
}

// ---- render ----
if (!existsSync(SF2)) {
  console.error(`Soundfont not found at ${SF2}. Set SF2=/path/to/gm.sf2`)
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

for (const song of SONGS) {
  const notes = parseSeq(song.seq)
  const mid = path.join(tmp, song.file.replace('.mp3', '.mid'))
  const wav = path.join(tmp, song.file.replace('.mp3', '.wav'))
  const out = path.join(outDir, song.file)
  writeFileSync(mid, buildMidi(notes, song.bpm))
  execFileSync('fluidsynth', ['-ni', '-g', '1.0', '-F', wav, '-r', '44100', SF2, mid], { stdio: 'ignore' })
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-b:a', '96k', '-movflags', '+faststart', out])
  console.log(`✓ ${song.file}`)
}
console.log('Done. Run: node scripts/build-music.mjs')
