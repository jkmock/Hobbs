// Giving props: the propeller shrinks under your finger, and when you let go it grows and spins
// two turns clockwise, winding up to full speed, slowing down, and settling into place (a
// touch past, then back). Each step starts from wherever the icon is drawn now, so a quick
// tap, or a press let go off the button, never jumps.
//
// It animates the `scale` and `rotate` properties of the icon (an <svg> turning about its hub,
// PropellerIcon's transform-origin), not `transform`.

const ID = 'prop-spin'
const SQUEEZED = 0.72
// Long enough, with a gentle wind-up, that at its fastest it turns about 1,300°/s (some 22° a
// frame): faster, and the three blades blur into a stutter the eye can't follow.
const SPIN_MS = 1600

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function stop(el: Element) {
  for (const a of el.getAnimations()) if (a.id === ID) a.cancel()
}

function scaleNow(el: Element) {
  const s = parseFloat(getComputedStyle(el).scale)
  return Number.isFinite(s) ? s : 1
}

function play(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  const animation = el.animate(keyframes, options)
  animation.id = ID
}

// Pressed: shrink, and stay small until let go.
export function squeeze(el: Element) {
  if (reducedMotion()) return
  const from = scaleNow(el)
  stop(el)
  play(el, [{ scale: String(from) }, { scale: String(SQUEEZED) }], { duration: 140, easing: 'ease-out', fill: 'forwards' })
}

// Let go without giving props (taking them back, or sliding off): just back to size.
export function unsqueeze(el: Element) {
  const from = scaleNow(el)
  stop(el)
  if (from === 1) return
  play(el, [{ scale: String(from) }, { scale: '1' }], { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
}

// Props given: grow and spin two turns.
export function spin(el: Element) {
  if (reducedMotion()) return unsqueeze(el)
  const from = scaleNow(el)
  stop(el)
  // Two turns clockwise: a slow start, winding up to its fastest around the middle, then a
  // long slow-down that carries a touch past and eases back to rest.
  play(
    el,
    [
      { rotate: '0deg', easing: 'cubic-bezier(0.45, 0, 0.3, 1)' },
      { rotate: '732deg', offset: 0.86, easing: 'cubic-bezier(0.4, 0, 0.3, 1)' },
      { rotate: '720deg' },
    ],
    { duration: SPIN_MS },
  )
  // Meanwhile it breathes with the spin: it swells as it winds up, biggest just as it's turning
  // fastest, then shrinks as it slows (gently at first, so it stays big through the middle),
  // dipping a little under full size around the swing back and rising a touch over before it rests. Each step eases out of the last and into
  // the next, so it never holds still at one size or changes pace with a jolt.
  play(
    el,
    [
      { scale: String(from), easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
      // From its biggest it shrinks slowly at first, then faster as the spin settles.
      { scale: '1.4', offset: 0.3, easing: 'cubic-bezier(0.7, 0, 0.4, 1)' },
      { scale: '0.94', offset: 0.86, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
      { scale: '1.03', offset: 0.95, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
      { scale: '1' },
    ],
    { duration: SPIN_MS },
  )
}
