import { useEffect, useLayoutEffect } from 'react'
import { claimStatusBarColor } from './statusBar'

// The launch splash: a navy screen (#splash, drawn by index.html so it's up before any script
// loads) that stays until the first screen is ready, then fades away to reveal it.
//
// Whatever the first screen waits on holds the splash up while it's loading: the login check,
// the feed's first page, the mini maps in view. Once nothing has held it for a moment (so
// what loads next, like the maps of cards that just appeared, can claim it first), it goes.
// It goes after MAX_MS whatever is still loading (offline, a map that never draws).

const NAVY = '#0f1f40' // --accent-light-mode
const SETTLE_MS = 150 // nothing holding it for this long: the screen is ready
const MAX_MS = 8000
const FADE_MS = 520

let holds = 0
let gone = false
let settle: ReturnType<typeof setTimeout> | undefined
let releaseStatusBar: (() => void) | undefined

// Call before installStatusBar, so the status bar starts navy too.
export function installSplash() {
  if (!document.getElementById('splash')) return void (gone = true)
  releaseStatusBar = claimStatusBarColor(NAVY)
  setTimeout(dismiss, MAX_MS)
  // React has a moment to mount and claim the splash; if nothing does, it goes.
  scheduleDismiss()
}

export function splashShowing() {
  return !gone
}

// Holds the splash up until the returned function is called.
export function holdSplash(): () => void {
  if (gone) return () => {}
  holds++
  clearTimeout(settle)
  let released = false
  return () => {
    if (released) return
    released = true
    holds--
    if (holds === 0) scheduleDismiss()
  }
}

// Holds the splash up while `waiting` is true.
export function useSplashHold(waiting: boolean) {
  useEffect(() => (waiting ? holdSplash() : undefined), [waiting])
}

// Holds the splash up while `waiting` is true, if `el` is in view when it first lays out
// (a mini map off screen, or on a hidden tab, doesn't hold up the first screen).
export function useSplashHoldInView(ref: { current: HTMLElement | null }, waiting: boolean) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!waiting || !el || gone) return
    const r = el.getBoundingClientRect()
    // Laid out on screen and actually showing: not hidden (Log Flight keeps its route map
    // loading, invisible, on the other steps) or in a part of the page that's switched off.
    const showing = !el.closest('[inert], [aria-hidden="true"]') && (el.checkVisibility?.({ visibilityProperty: true }) ?? true)
    const inView = showing && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight
    return inView ? holdSplash() : undefined
  }, [ref, waiting])
}

function scheduleDismiss() {
  clearTimeout(settle)
  settle = setTimeout(() => {
    // Two frames on, so the screen under it has painted what it was waiting for (or a moment
    // on, where frames are paused: a background tab, a webview not drawing).
    let done = false
    const go = () => {
      if (done) return
      done = true
      if (holds === 0) dismiss()
    }
    requestAnimationFrame(() => requestAnimationFrame(go))
    setTimeout(go, 100)
  }, SETTLE_MS)
}

function dismiss() {
  if (gone) return
  gone = true
  clearTimeout(settle)
  const el = document.getElementById('splash')
  releaseStatusBar?.()
  if (!el) return
  el.classList.add('splash--leaving')
  const remove = () => el.remove()
  el.addEventListener('transitionend', (e) => e.target === el && remove())
  setTimeout(remove, FADE_MS + 200) // reduced motion has no transition to end
}
