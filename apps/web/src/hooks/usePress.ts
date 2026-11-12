import { useEffect, useRef, type PointerEvent } from 'react'
import { popOut, pressIn, release } from '../lib/press'

// Press-and-pop for fun: touching the element presses it in, and letting go pops it (grows
// just past full size and settles). Spread the returned handlers on the element.
//
// Like a flight card in the list: a finger waits a moment, without moving, before pressing,
// so scrolling never presses anything; moving away or scrolling springs it back without a pop.

const MOVE_SLOP = 8 // px a finger can drift and still be pressing
const PRESS_DELAY_MS = 90 // a finger rests this long before the press (a mouse presses at once)

type Touch = { x: number; y: number; pressed: boolean; timer: number; el: HTMLElement }

export function usePress() {
  const touch = useRef<Touch | null>(null)
  useEffect(() => () => clearTimeout(touch.current?.timer), [])

  function press(t: Touch) {
    clearTimeout(t.timer)
    if (t.pressed) return
    t.pressed = true
    pressIn(t.el)
  }
  // Not a press any more: spring back (no pop) if it was pressed.
  function cancel() {
    const t = touch.current
    touch.current = null
    if (!t) return
    clearTimeout(t.timer)
    if (t.pressed) release(t.el)
  }

  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0) return
      clearTimeout(touch.current?.timer)
      const t: Touch = { x: e.clientX, y: e.clientY, pressed: false, timer: 0, el: e.currentTarget }
      touch.current = t
      if (e.pointerType === 'mouse') press(t)
      else t.timer = window.setTimeout(() => press(t), PRESS_DELAY_MS)
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const t = touch.current
      if (t && Math.hypot(e.clientX - t.x, e.clientY - t.y) > MOVE_SLOP) cancel()
    },
    onPointerUp() {
      const t = touch.current
      touch.current = null
      if (!t) return
      press(t) // a quick tap, quicker than the delay, still gets its press
      popOut(t.el)
    },
    onPointerLeave: cancel,
    onPointerCancel: cancel, // the browser took over (a scroll)
  }
}
