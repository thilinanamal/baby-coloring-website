import { PALETTE, MAGIC } from '../data/palette'

interface Props {
  active: string
  isMagic: boolean
  onPick: (hex: string, magic: boolean) => void
}

export default function Palette({ active, isMagic, onPick }: Props) {
  return (
    <div className="palette">
      {PALETTE.map((s) => (
        <button
          key={s.name}
          className={`swatch${!isMagic && active === s.hex ? ' selected' : ''}${s.name === 'white' ? ' is-white' : ''}`}
          style={{ background: s.hex }}
          aria-label={s.name}
          onPointerDown={() => onPick(s.hex, false)}
        />
      ))}
      <button
        className={`swatch magic${isMagic ? ' selected' : ''}`}
        aria-label="magic"
        onPointerDown={() => onPick(MAGIC, true)}
      >
        🌈
      </button>
    </div>
  )
}
