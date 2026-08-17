// One shared AudioContext for the whole app (SFX + music). Browsers cap the
// number of contexts, and sharing lets the lullaby sit under the tap sounds.
// Created lazily; resumed on demand (needs a prior user gesture to run).

let ctx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Run cb once the context is actually running (resume now, or on next gesture). */
export function whenRunning(cb: () => void): () => void {
  const ac = getAudioContext()
  if (ac.state === 'running') {
    cb()
    return () => {}
  }
  let done = false
  const go = () => {
    if (done) return
    done = true
    cleanup()
    cb()
  }
  const onState = () => {
    if (ac.state === 'running') go()
  }
  const onGesture = () => {
    void ac.resume().then(() => {
      if (ac.state === 'running') go()
    })
  }
  const cleanup = () => {
    ac.removeEventListener('statechange', onState)
    document.removeEventListener('pointerdown', onGesture)
  }
  ac.addEventListener('statechange', onState)
  document.addEventListener('pointerdown', onGesture)
  void ac.resume()
  return cleanup
}
