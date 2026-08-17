// 12 named crayon-box colours toddlers recognise + a magic random swatch.
// White doubles as an eraser (fills a region back to white).

export interface Swatch {
  name: string
  hex: string
}

export const PALETTE: Swatch[] = [
  { name: 'red', hex: '#ff3b30' },
  { name: 'orange', hex: '#ff9500' },
  { name: 'yellow', hex: '#ffd60a' },
  { name: 'green', hex: '#34c759' },
  { name: 'blue', hex: '#0a84ff' },
  { name: 'purple', hex: '#af52de' },
  { name: 'pink', hex: '#ff2d92' },
  { name: 'brown', hex: '#a2673f' },
  { name: 'black', hex: '#1c1c1e' },
  { name: 'white', hex: '#ffffff' },
  { name: 'skin', hex: '#ffcc99' },
  { name: 'sky', hex: '#7fd3ff' },
]

export const MAGIC = 'magic'

/** A random bright, saturated colour for the 🌈 magic swatch. */
export function randomBrightHex(): string {
  const hue = Math.floor(Math.random() * 360)
  return hslToHex(hue, 85, 58)
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const color = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
