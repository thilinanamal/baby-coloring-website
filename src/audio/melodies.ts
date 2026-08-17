// Public-domain nursery melodies encoded as note data (no audio files).
// freq 0 = rest. Melodies are simple, calm, and instantly recognisable.

export interface Note {
  freq: number
  beats: number
}
export interface Melody {
  name: string
  bpm: number
  notes: Note[]
}

const A4 = 440
const SEMI: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
}

function noteFreq(name: string): number {
  const m = name.match(/^([A-G]#?)(\d)$/)
  if (!m) return 0
  const midi = (parseInt(m[2]) + 1) * 12 + SEMI[m[1]]
  return A4 * Math.pow(2, (midi - 69) / 12)
}

// n('C4') = quarter note; n('C4', 2) = half; n('R', 1) = rest
const n = (name: string, beats = 1): Note => ({ freq: name === 'R' ? 0 : noteFreq(name), beats })

export const MELODIES: Melody[] = [
  {
    name: 'Twinkle Twinkle',
    bpm: 92,
    notes: [
      n('C4'), n('C4'), n('G4'), n('G4'), n('A4'), n('A4'), n('G4', 2),
      n('F4'), n('F4'), n('E4'), n('E4'), n('D4'), n('D4'), n('C4', 2),
      n('G4'), n('G4'), n('F4'), n('F4'), n('E4'), n('E4'), n('D4', 2),
      n('G4'), n('G4'), n('F4'), n('F4'), n('E4'), n('E4'), n('D4', 2),
      n('C4'), n('C4'), n('G4'), n('G4'), n('A4'), n('A4'), n('G4', 2),
      n('F4'), n('F4'), n('E4'), n('E4'), n('D4'), n('D4'), n('C4', 2),
      n('R', 2),
    ],
  },
  {
    name: 'Mary Had a Little Lamb',
    bpm: 96,
    notes: [
      n('E4'), n('D4'), n('C4'), n('D4'), n('E4'), n('E4'), n('E4', 2),
      n('D4'), n('D4'), n('D4', 2), n('E4'), n('G4'), n('G4', 2),
      n('E4'), n('D4'), n('C4'), n('D4'), n('E4'), n('E4'), n('E4'), n('E4'),
      n('D4'), n('D4'), n('E4'), n('D4'), n('C4', 3),
      n('R', 2),
    ],
  },
  {
    name: "Brahms' Lullaby",
    bpm: 84,
    notes: [
      n('E4'), n('E4'), n('G4', 2), n('E4'), n('E4'), n('G4', 2),
      n('E4'), n('G4'), n('C5'), n('B4'), n('A4', 2), n('A4'), n('G4', 3),
      n('D4'), n('E4'), n('F4', 2), n('D4'), n('E4'), n('F4', 2),
      n('D4'), n('F4'), n('B4'), n('A4'), n('G4'), n('B4'), n('C5', 3),
      n('R', 2),
    ],
  },
  {
    name: 'Rock-a-bye Baby',
    bpm: 80,
    notes: [
      n('G4'), n('E4'), n('G4'), n('A4'), n('G4', 2),
      n('G4'), n('E4'), n('C4'), n('D4'), n('E4', 2),
      n('F4'), n('D4'), n('F4'), n('A4'), n('G4', 2),
      n('E4'), n('C4'), n('G4'), n('D4'), n('C4', 3),
      n('R', 2),
    ],
  },
  {
    name: 'Hush Little Baby',
    bpm: 90,
    notes: [
      n('E4'), n('E4'), n('E4'), n('C4'), n('E4'), n('E4'), n('G4', 2),
      n('E4'), n('E4'), n('E4'), n('C4'), n('D4'), n('D4'), n('C4', 2),
      n('G4'), n('G4'), n('E4'), n('C4'), n('D4'), n('E4'), n('C4', 2),
      n('R', 2),
    ],
  },
]
