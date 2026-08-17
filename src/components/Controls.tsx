import { useNavigate } from 'react-router-dom'
import HoldButton from './HoldButton'

interface Props {
  canUndo: boolean
  onUndo: () => void
  onClean: () => void
}

const base = import.meta.env.BASE_URL

export default function Controls({ canUndo, onUndo, onClean }: Props) {
  const navigate = useNavigate()
  return (
    <div className="controls">
      <button
        className={`ctrl-btn${canUndo ? '' : ' disabled'}`}
        aria-label="undo"
        onPointerDown={() => canUndo && onUndo()}
      >
        ↩️
      </button>
      <HoldButton label="clean" emoji="🧹" onComplete={onClean} />
      <HoldButton label="home" emoji="🏠" onComplete={() => navigate(base)} />
    </div>
  )
}
