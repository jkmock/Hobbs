import { useCallback, useEffect, useLayoutEffect, useRef, useState, type TransitionEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import FlightMap, { type LoneAirport, type RouteLeg } from './FlightMap'
import styles from './ChartViewer.module.css'

type Props = {
  legs: RouteLeg[]
  airports?: LoneAirport[] // airports marked on their own (one end of a leg still being typed)
  title: string
  onClose: () => void
  from?: HTMLElement | null // the mini map it opens from (or the button around it), to grow out of
}

// A full-screen map you can pan and zoom, opened from a route map, on our FlightAware-style
// chart.
//
// Opened from a mini map, it grows out of it: the full-screen map starts on exactly the mini
// map's view, lined up with where the mini map sits, cut down to the mini map's box, and
// invisible. Once it has fully drawn (the whole screen's worth of tiles, so nothing is left to
// fill in), it shows, looking exactly like the mini map under it, and the box opens out to the
// full screen, showing more of the same map around it, while the map glides to frame the
// route (both take GLIDE_MS, with the same easing).
// Closing runs it all backwards into the mini map.
export default function ChartViewer({ legs, airports, title, onClose, from }: Props) {

  // The mini map's box to grow out of, if there is one and motion is welcome. Only its place
  // on screen is needed (the view is worked out from the route), so this works even if the
  // mini map hasn't loaded yet.
  const [origin] = useState(() => {
    if (!from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
    const box = from.matches('[data-route-map]') ? from : from.querySelector('[data-route-map]')
    return box ? { box } : null
  })
  const [rect, setRect] = useState(() => (origin ? screenBox(origin.box) : null))
  // start: cut down to the mini map (invisible until drawn); open: full screen; closing: shrinking back.
  const [phase, setPhase] = useState<'start' | 'open' | 'closing'>(origin ? 'start' : 'open')
  const [mapLoaded, setMapLoaded] = useState(false)
  // Shown and opening out once drawn, or after a moment if the tiles are slow.
  const [slow, setSlow] = useState(false)
  const ready = !origin || mapLoaded || slow
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  // Held on the mini map's view until it has opened out and drawn, and again while closing.
  const holdView = !!origin && (phase !== 'open' || !mapLoaded)

  // Once drawn, show it cut down to the mini map, then open out on the frame after next, so
  // the browser has drawn the cut-down box to animate from.
  useLayoutEffect(() => {
    if (phase !== 'start' || !ready) return
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase('open'))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [phase, ready])

  const closeTimer = useRef(0)
  const close = useCallback(() => {
    if (!origin || !origin.box.isConnected) return onClose()
    setRect(screenBox(origin.box)) // it may have moved (the page scrolled)
    setPhase('closing')
    closeTimer.current = window.setTimeout(onClose, 1000) // in case the transition never ends
  }, [origin, onClose])
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    // Stop the page underneath from scrolling while the chart is open.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [close])

  function onTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || e.propertyName !== 'clip-path') return
    if (phase === 'closing') onClose()
  }

  const clipPath = !origin
    ? undefined
    : phase === 'open'
      ? 'inset(0px 0px 0px 0px round 0px)'
      : `inset(${rect!.top}px ${window.innerWidth - rect!.right}px ${window.innerHeight - rect!.bottom}px ${rect!.left}px round var(--radius-sm))`

  return createPortal(
    <div
      className={`${styles.overlay} ${origin ? styles.animated : ''} ${ready ? '' : styles.waiting}`}
      style={{ clipPath }}
      onTransitionEnd={onTransitionEnd}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <FlightMap
        legs={legs}
        airports={airports}
        interactive
        onLoad={() => setMapLoaded(true)}
        startBox={rect ?? undefined}
        holdView={holdView}
      />
      <div className={`${styles.controls} ${phase === 'open' ? '' : styles.controlsHidden}`}>
        <button type="button" className={styles.close} onClick={close} aria-label="Close map" autoFocus>
          <X size={40} strokeWidth={2.25} />
        </button>
      </div>
    </div>,
    document.body,
  )
}

// Where the mini map's box is on screen, at its real size: if its card is pressed in (scaled
// down a touch) when tapped, this is the box it fills once it springs back.
function screenBox(el: Element) {
  const r = el.getBoundingClientRect()
  const { offsetWidth: width, offsetHeight: height } = el as HTMLElement
  const x = (r.left + r.right) / 2
  const y = (r.top + r.bottom) / 2
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2, width, height }
}
