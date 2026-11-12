// Pressing a card in and letting it go: it shrinks a little under your finger and springs
// back when released. FlightCard presses on touch; FlightsPage carries a pressed card on into
// its opening animation.

export const PRESS_SCALE = 0.985
export const PRESS_MS = 110
export const POP_SCALE = 1.008
export const POP_MS = 260

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// The scale an element is drawn at now (1 if it isn't scaled).
export function scaleOf(el: Element) {
  const m = getComputedStyle(el).transform.match(/^matrix\(([^,]+),\s*([^,]+)/)
  return m ? Math.hypot(Number(m[1]), Number(m[2])) : 1
}

// Shrink to PRESS_SCALE from wherever it is now, and stay there.
export function pressIn(el: HTMLElement) {
  if (reducedMotion()) return
  const from = scaleOf(el)
  stopAnimations(el)
  el.animate([{ transform: `scale(${from})` }, { transform: `scale(${PRESS_SCALE})` }], {
    duration: PRESS_MS,
    easing: 'ease-out',
    fill: 'forwards',
  })
}

// Spring back to full size from wherever it is now.
export function release(el: HTMLElement) {
  const from = scaleOf(el)
  stopAnimations(el)
  if (from === 1) return
  el.animate([{ transform: `scale(${from})` }, { transform: 'scale(1)' }], {
    duration: 220,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  })
}

// Let go after a press: grow just past full size and settle, from wherever it is now.
export function popOut(el: HTMLElement) {
  const from = scaleOf(el)
  stopAnimations(el)
  if (reducedMotion()) return
  el.animate(
    [
      { transform: `scale(${from})`, easing: 'ease-out' },
      { transform: `scale(${POP_SCALE})`, offset: 0.45, easing: 'ease-in-out' },
      { transform: 'scale(1)' },
    ],
    { duration: POP_MS },
  )
}

// Ends the element's own animations (not those of what's inside it).
export function stopAnimations(el: HTMLElement) {
  for (const a of el.getAnimations()) a.cancel()
}
