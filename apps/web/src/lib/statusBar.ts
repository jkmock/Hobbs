import { useEffect } from 'react'

// The color of the bar at the top of the screen (the iPhone's status bar area in Safari, the
// browser's toolbar on Android), set through <meta name="theme-color">. Safari reads that tag
// whenever it changes, so the bar follows the theme without a reload, and a screen that's all
// map (the Map tab, the full-screen map) turns it the map's color so the map seems to run up
// under it.
//
// The base color is the page's own background (--paper on <html>), read whenever the theme
// changes: picked in Settings (data-theme on <html>) or by the system (light/dark).
//
// Some Safari versions color the bar from the page's background rather than the tag, so on a
// phone-width screen a map screen's color is also put on the page itself (on a wider screen
// <html> shows beside the app's column, so it's left alone there).

const claims: string[] = [] // colors asked for by screens now showing; the newest wins
const phone = window.matchMedia('(max-width: 560px)')

let meta: HTMLMetaElement | null = null

function update() {
  if (!meta) {
    meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.append(meta)
    }
  }
  const root = document.documentElement
  const claim = claims.at(-1)
  // <body> paints over <html>, so both take it.
  const page = claim && phone.matches ? claim : ''
  root.style.backgroundColor = page
  document.body.style.backgroundColor = page
  const color = claim ?? getComputedStyle(root).backgroundColor
  if (meta.content !== color) meta.content = color
}

export function installStatusBar() {
  update()
  new MutationObserver(update).observe(document.documentElement, { attributeFilter: ['data-theme'] })
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update)
  phone.addEventListener('change', update)
}

// Colors the bar `color` while this component is showing and `color` is set.
export function useStatusBarColor(color: string | null) {
  useEffect(() => {
    if (!color) return
    claims.push(color)
    update()
    return () => {
      claims.splice(claims.lastIndexOf(color), 1)
      update()
    }
  }, [color])
}
