import { useEffect, type RefObject } from 'react'

// Marks each link in a translucent bar (the glass tab bar) with data-on-dark while what's
// behind it is dark, so its icon can turn white. A page can't read its own pixels, so this
// finds the element painted behind each link's center and works out its background color
// (a gradient counts as the average of its colors; a map canvas or image counts as whatever
// is behind it), blended with the bar's own tint.
export function useBackdropTone(barRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    let frame = 0
    const check = () => {
      frame = 0
      const tint = toRgba(getComputedStyle(bar).backgroundColor)
      for (const link of bar.querySelectorAll<HTMLElement>('a')) {
        const box = link.getBoundingClientRect()
        const behind = document
          .elementsFromPoint(box.left + box.width / 2, box.top + box.height / 2)
          .find((el) => !bar.contains(el))
        let color = behind ? backgroundOf(behind) : null
        if (!color) continue // off screen (the bar slid away)
        if (tint) color = mix(color, tint, tint[3])
        // Hysteresis, so a background right at the threshold doesn't flicker.
        const lum = luminance(color)
        const dark = link.hasAttribute('data-on-dark') ? lum < 0.36 : lum < 0.3
        link.toggleAttribute('data-on-dark', dark)
      }
    }
    const schedule = () => {
      frame ||= requestAnimationFrame(check)
    }
    schedule()
    // Scrolling anything (scroll events don't bubble, so listen in the capture phase), resizing,
    // the page changing (switching tabs swaps the content behind the bar without any scroll;
    // checked in the same frame, so the icons change along with the page), and now and then for
    // things that change without either: a map panning, images loading, a theme switch.
    document.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule)
    // Changes inside the bar (the pill moving, these attributes) are ignored.
    const mutations = new MutationObserver((records) => {
      if (records.some((r) => !bar.contains(r.target))) schedule()
    })
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    const timer = setInterval(schedule, 400)
    return () => {
      cancelAnimationFrame(frame)
      mutations.disconnect()
      document.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      clearInterval(timer)
    }
  }, [barRef])
}

type Rgba = [number, number, number, number] // 0-255, alpha 0-1

// The background an element shows: its own, or the nearest ancestor's that's mostly opaque.
function backgroundOf(start: Element): Rgba | null {
  for (let el: Element | null = start; el; el = el.parentElement) {
    const style = getComputedStyle(el)
    if (style.backgroundImage.includes('gradient')) {
      const stops = (style.backgroundImage.match(COLOR) ?? []).map(toRgba).filter((c) => c !== null)
      if (stops.length) return average(stops)
    }
    const color = toRgba(style.backgroundColor)
    if (color && color[3] >= 0.5) return color
  }
  return toRgba(getComputedStyle(document.documentElement).backgroundColor)
}

const COLOR = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi

// Any CSS color (computed colors can come back as rgb(), color(srgb ...), oklch() and so on)
// as RGBA, by painting it into a 1px canvas. Cached: the same few colors come up again and again.
let ctx: CanvasRenderingContext2D | null | undefined
const cache = new Map<string, Rgba | null>()
function toRgba(color: string): Rgba | null {
  const cached = cache.get(color)
  if (cached !== undefined) return cached
  let result: Rgba | null = null
  if (color && CSS.supports('color', color)) {
    ctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    if (ctx) {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 1, 1)
      const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data
      result = [r, g, b, a / 255]
    }
  }
  cache.set(color, result)
  return result
}

function average(colors: Rgba[]): Rgba {
  let [r, g, b] = [0, 0, 0]
  for (const c of colors) [r, g, b] = [r + c[0], g + c[1], b + c[2]]
  return [r / colors.length, g / colors.length, b / colors.length, 1]
}

function mix(base: Rgba, over: Rgba, amount: number): Rgba {
  const m = (a: number, b: number) => a * (1 - amount) + b * amount
  return [m(base[0], over[0]), m(base[1], over[1]), m(base[2], over[2]), 1]
}

// WCAG relative luminance, 0 (black) to 1 (white).
function luminance([r, g, b]: Rgba) {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
