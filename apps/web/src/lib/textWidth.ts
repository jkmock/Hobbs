import { useEffect, useState } from 'react'

// Measures text in a given CSS font, for sizing an input to exactly what's typed.
// (CSS `field-sizing: content` would do this, but not every browser supports it yet.)

let canvas: HTMLCanvasElement | null = null

export function textWidth(text: string, font: string, letterSpacingPx = 0): number {
  canvas ??= document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return text.length * 16
  ctx.font = font
  return ctx.measureText(text).width + letterSpacingPx * text.length
}

// Re-renders once web fonts have loaded, so widths measured with a fallback font get redone.
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(() => document.fonts?.status === 'loaded')
  useEffect(() => {
    if (ready) return
    let cancelled = false
    document.fonts?.ready.then(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
  }, [ready])
  return ready
}
