import { useLayoutEffect, useRef } from 'react'

// A button that becomes another button on the next page, in the same spot: the Feed's Add
// friends (or My Friends) and the Friends page's Done. Tapping one notes its width; the other,
// as its page opens, starts at that width and eases to its own, so it reads as one button
// shrinking or growing. Each side uses the same key.

const MORPH_MS = 320
const FRESH_MS = 1500 // a width noted longer ago than this is from some other visit

const noted = new Map<string, { width: number; at: number }>()

// Ref for the button, and an onClick that notes its width before its page goes.
export function useMorphWidth<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const from = noted.get(key)
    noted.delete(key)
    if (!el || !from || performance.now() - from.at > FRESH_MS) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const to = el.offsetWidth // its layout width (a press's scale doesn't count)
    if (Math.abs(to - from.width) < 1) return
    el.animate([{ width: `${from.width}px` }, { width: `${to}px` }], {
      duration: MORPH_MS,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    })
  }, [key])

  const onClick = () => {
    if (ref.current) noted.set(key, { width: ref.current.offsetWidth, at: performance.now() })
  }
  return { ref, onClick }
}
