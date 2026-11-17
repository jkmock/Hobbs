import { POP_MS, POP_SCALE, PRESS_MS, PRESS_SCALE } from './press'

// Every card in the app presses in under your finger and pops when you let go, like a flight
// card. One listener on the document covers them all; a card that presses itself (usePress,
// FlightCard) is marked data-own-press, and data-no-press on or around one opts it out.
//
// Touching a button, link, field or map inside a card leaves the card alone (the button has its
// own press, lib/buttonPress). A finger rests a moment, without moving, before the card presses,
// so scrolling never presses one; moving or scrolling springs it back without a pop.
//
// It animates the `scale` property, not `transform`, so it composes with a card's own transform.

const ID = 'card-press'
const MOVE_SLOP = 8 // px a finger can drift and still be pressing
const PRESS_DELAY_MS = 90 // a finger rests this long before the press (a mouse presses at once)
const INSIDE_CONTROL =
  'button, a, input, textarea, select, label, summary, [role="button"], [role="option"], [contenteditable], .maplibregl-map'

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function scaleNow(el: HTMLElement) {
  const s = parseFloat(getComputedStyle(el).scale)
  return Number.isFinite(s) ? s : 1
}

function animate(el: HTMLElement, to: number[], options: KeyframeAnimationOptions) {
  const from = scaleNow(el)
  for (const a of el.getAnimations()) if (a.id === ID) a.cancel()
  const animation = el.animate([from, ...to].map((s) => ({ scale: String(s) })), options)
  animation.id = ID
}

const pressIn = (el: HTMLElement) => animate(el, [PRESS_SCALE], { duration: PRESS_MS, easing: 'ease-out', fill: 'forwards' })
const springBack = (el: HTMLElement) => animate(el, [1], { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
// Grow just past full size and settle, from wherever it is now (replacing the held press).
function popOut(el: HTMLElement) {
  const from = scaleNow(el)
  for (const a of el.getAnimations()) if (a.id === ID) a.cancel()
  const animation = el.animate(
    [
      { scale: String(from), easing: 'ease-out' },
      { scale: String(POP_SCALE), offset: 0.45, easing: 'ease-in-out' },
      { scale: '1' },
    ],
    { duration: POP_MS },
  )
  animation.id = ID
}

export function installCardPress() {
  let touch: { card: HTMLElement; x: number; y: number; pointerId: number; pressed: boolean; timer: number } | null = null

  const press = () => {
    if (!touch || touch.pressed) return
    clearTimeout(touch.timer)
    touch.pressed = true
    pressIn(touch.card)
  }
  // Not a press any more (moved, scrolled, interrupted): back to size, no pop.
  const cancel = () => {
    if (!touch) return
    clearTimeout(touch.timer)
    if (touch.pressed) springBack(touch.card)
    touch = null
  }

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || reducedMotion() || !(e.target instanceof Element)) return
      const card = e.target.closest<HTMLElement>('.card')
      if (!card || card.closest('[data-own-press], [data-no-press]')) return
      // A control inside the card (or a card that is itself one) handles its own touch.
      const control = e.target.closest(INSIDE_CONTROL)
      if (control && card.contains(control)) return
      cancel()
      touch = { card, x: e.clientX, y: e.clientY, pointerId: e.pointerId, pressed: false, timer: 0 }
      if (e.pointerType === 'mouse') press()
      else touch.timer = window.setTimeout(press, PRESS_DELAY_MS)
    },
    { capture: true, passive: true },
  )
  document.addEventListener(
    'pointermove',
    (e) => {
      if (touch && e.pointerId === touch.pointerId && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > MOVE_SLOP) cancel()
    },
    { capture: true, passive: true },
  )
  document.addEventListener(
    'pointerup',
    (e) => {
      if (!touch || e.pointerId !== touch.pointerId) return
      const card = touch.card
      press() // a quick tap, quicker than the delay, still gets its press
      touch = null
      popOut(card)
    },
    { capture: true, passive: true },
  )
  document.addEventListener('pointercancel', (e) => e.pointerId === touch?.pointerId && cancel(), { capture: true, passive: true })
  window.addEventListener('blur', cancel)
}
