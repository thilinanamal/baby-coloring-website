// Map a pointer event on the displayed canvas to an image-pixel index.
// The canvas backing store is at natural image resolution; CSS scales it down,
// so we convert client coords → backing-store coords via the bounding rect.

export function pointerToPixel(
  e: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): number | null {
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  const nx = (e.clientX - rect.left) / rect.width
  const ny = (e.clientY - rect.top) / rect.height
  if (nx < 0 || nx >= 1 || ny < 0 || ny >= 1) return null
  const x = Math.floor(nx * canvas.width)
  const y = Math.floor(ny * canvas.height)
  return y * canvas.width + x
}
