// Keeps the page at its own size, like a native app. iOS Safari ignores user-scalable=no in
// the viewport meta, so its pinch-zoom gesture is cancelled here; Chrome and others honour
// the meta. On a computer, trackpad pinch (a wheel event with ctrlKey) and Cmd/Ctrl +/-/0
// are blocked too. The map still pinch-zooms: it handles touch and wheel events itself, and
// only the page's own zoom is prevented.
export function installNoZoom() {
  const cancel = (e: Event) => e.preventDefault()
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, cancel, { passive: false })
  }
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault()
    },
    { passive: false },
  )
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && ['+', '=', '-', '_', '0'].includes(e.key)) e.preventDefault()
  })
}
