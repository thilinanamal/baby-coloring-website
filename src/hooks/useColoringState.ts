// In-memory colouring state: current regionId→hex map plus an undo stack of
// snapshots. Nothing is persisted — refresh / new tab starts blank, which
// gives every visitor an isolated session for free.
//
// A ref mirrors the map so paint/undo/clean can decide + return synchronously
// (React does not guarantee a setState updater runs before it returns).

import { useCallback, useRef, useState } from 'react'

type ColorMap = Map<number, string>

export function useColoringState() {
  const [colors, setColorsState] = useState<ColorMap>(() => new Map())
  const colorsRef = useRef<ColorMap>(colors)
  const undoStack = useRef<ColorMap[]>([])
  const [canUndo, setCanUndo] = useState(false)

  const commit = useCallback((next: ColorMap) => {
    colorsRef.current = next
    setColorsState(next)
  }, [])

  const pushSnapshot = useCallback(() => {
    undoStack.current.push(new Map(colorsRef.current))
    if (undoStack.current.length > 200) undoStack.current.shift()
    setCanUndo(true)
  }, [])

  /** Paint a region. Returns the applied hex, or null if it was a no-op. */
  const paint = useCallback(
    (id: number, hex: string): string | null => {
      if (colorsRef.current.get(id) === hex) return null
      pushSnapshot()
      const next = new Map(colorsRef.current)
      next.set(id, hex)
      commit(next)
      return hex
    },
    [commit, pushSnapshot],
  )

  const undo = useCallback((): boolean => {
    const prev = undoStack.current.pop()
    if (!prev) return false
    commit(prev)
    setCanUndo(undoStack.current.length > 0)
    return true
  }, [commit])

  const clean = useCallback((): boolean => {
    if (colorsRef.current.size === 0) return false
    pushSnapshot()
    commit(new Map())
    return true
  }, [commit, pushSnapshot])

  return { colors, paint, undo, clean, canUndo }
}
