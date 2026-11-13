// Every button in the app presses in under your finger (or mouse) and springs back out when
// you let go, with a touch of overshoot. One listener on the document covers them all, so
// buttons need nothing added; data-no-press on an element (or around it) opts it out, as the
// tab bar does (it has its own press-and-drag pill). A button with a child marked
// data-press-target presses just that child: a recent-flight row presses only its checkbox.
//
// It animates the `scale` property, not `transform`, so it composes with a button's own
// transform (one centered with translateY(-50%), say) instead of replacing it. Each press and
// release starts from wherever the button is drawn now, so quick taps never jump.

const BUTTONS = 'button, .btn, .icon-btn, [role="button"], summary'
const ID = 'button-press'

// How far it goes in: about 6px across, so small buttons visibly press and wide ones don't
// shrink by a lot (a 40px icon button to 0.92, a full-width button to about 0.98).
const pressedScale = (el: HTMLElement) =>
  1 - Math.min(0.08, 6 / Math.max(el.offsetWidth, el.offsetHeight, 1))

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function currentScale(el: HTMLElement) {
  const s = parseFloat(getComputedStyle(el).scale)
  return Number.isFinite(s) ? s : 1
}

function animateScale(el: HTMLElement, keyframes: number[], options: KeyframeAnimationOptions) {
  const from = currentScale(el)
  for (const a of el.getAnimations()) if (a.id === ID) a.cancel()
  const animation = el.animate(
    [from, ...keyframes].map((s) => ({ scale: String(s) })),
    options,
  )
  animation.id = ID
}

function pressIn(el: HTMLElement) {
  animateScale(el, [pressedScale(el)], { duration: 90, easing: 'ease-out', fill: 'forwards' })
}

// Back out, just past full size, then settle.
function releaseOut(el: HTMLElement) {
  const overshoot = 1 + (1 - pressedScale(el)) * 0.35
  animateScale(el, [overshoot, 1], { duration: 300, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' })
}

const MOVE_SLOP = 10 // px past the button's edge before a dragged-off press lets go

export function installButtonPress() {
  // el: the button (drag off it to let go); target: what's animated (the button, or its press target).
  let pressed: { el: HTMLElement; target: HTMLElement; pointerId: number } | null = null

  const letGo = () => {
    if (pressed) releaseOut(pressed.target)
    pressed = null
  }

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || reducedMotion() || !(e.target instanceof Element)) return
      const el = e.target.closest<HTMLElement>(BUTTONS)
      if (!el || el.closest('[data-no-press]') || el.matches(':disabled, [aria-disabled="true"]')) return
      letGo()
      const target = el.querySelector<HTMLElement>('[data-press-target]') ?? el
      pressed = { el, target, pointerId: e.pointerId }
      pressIn(target)
    },
    { passive: true },
  )
  // Dragged off the button (it won't be clicked): back out, as on iOS.
  document.addEventListener(
    'pointermove',
    (e) => {
      if (!pressed || e.pointerId !== pressed.pointerId) return
      const box = pressed.el.getBoundingClientRect()
      const outside =
        e.clientX < box.left - MOVE_SLOP ||
        e.clientX > box.right + MOVE_SLOP ||
        e.clientY < box.top - MOVE_SLOP ||
        e.clientY > box.bottom + MOVE_SLOP
      if (outside) letGo()
    },
    { passive: true },
  )
  for (const type of ['pointerup', 'pointercancel'] as const) {
    document.addEventListener(type, (e) => e.pointerId === pressed?.pointerId && letGo(), { passive: true })
  }
  // Releasing outside the window, or the window losing focus mid-press.
  window.addEventListener('blur', letGo)
}
