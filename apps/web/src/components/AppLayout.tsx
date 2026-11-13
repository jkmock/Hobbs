import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router'
import KeptTabs from './KeptTabs'
import { keptTabOf, useKeptLocations } from '../hooks/useKeptLocations'
import { ChartBar, CircleUser, Earth, Plane, UsersRoundCollaboration } from 'lucide-react'
import { useBackdropTone } from '../hooks/useBackdropTone'
import MapPreloader from './MapPreloader'
import styles from './AppLayout.module.css'

const TABS = [
  { to: '/', label: 'Feed', icon: UsersRoundCollaboration },
  { to: '/flights', label: 'Flights', icon: Plane },
  { to: '/map', label: 'Map', icon: Earth },
  { to: '/goal', label: 'Goal', icon: ChartBar },
  { to: '/profile', label: 'Profile', icon: CircleUser },
]

// Pages with the bottom tab bar.
export function TabLayout() {
  // A flight's page (part of My flights, or of the social feed) is full screen, so the tab
  // bar slides away.
  const onMyFlight = useMatch('/flights/:id') !== null
  const onFeedFlight = useMatch('/feed/:id') !== null
  const onFlight = onMyFlight || onFeedFlight
  // The Feed, My Flights and Map stay as they were left when another tab is used (KeptTabs).
  const kept = useKeptLocations()

  // The selection pill slides between tabs: measure the selected tab (NavLink marks it
  // .active) whenever the route changes or the bar resizes, and move the pill there.
  const navRef = useRef<HTMLElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  // Icons turn white over dark content behind the glass (data-on-dark on each tab).
  useBackdropTone(navRef)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const measure = () => {
      const tab = nav.querySelector<HTMLElement>('a.active')
      // With no tab selected (a page outside the tabs) the pill stays where it was and fades out.
      setPill((prev) => (tab ? { x: tab.offsetLeft, width: tab.offsetWidth } : prev))
      setHasSelection(!!tab)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [pathname])
  // Transitions start after the pill's first placement, so it doesn't slide in on load.
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    if (!pill || animated) return
    const frame = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(frame)
  }, [pill, animated])

  // Press and hold anywhere on the bar: the pill jumps toward the finger and loosely follows
  // it (a spring, run each frame). On release the tab nearest the finger opens at once, and
  // the pill springs over to it, catching up. A quick tap is the same gesture, just short.
  // While the gesture moves the pill, `spring` holds its state and sets its position directly;
  // otherwise the pill sits on the selected tab and CSS animates its moves.
  const [held, setHeld] = useState(false) // finger down: the pill is lifted
  const [driven, setDriven] = useState(false) // the spring, not CSS, is moving the pill
  const [under, setUnder] = useState<number | null>(null) // the tab under the pill meanwhile
  const pointerId = useRef<number | null>(null)
  const spring = useRef<{ x: number; v: number; target: number; release: boolean; last: number } | null>(null)
  const frame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  // Placed on the selected tab, unless the gesture has it.
  useLayoutEffect(() => {
    if (pill && pillRef.current && !spring.current) pillRef.current.style.translate = `${pill.x}px 0`
  }, [pill])

  const tabEls = () => [...(navRef.current?.querySelectorAll<HTMLElement>('a') ?? [])]
  const nearestTab = (x: number) => {
    let best = 0
    let bestDistance = Infinity
    tabEls().forEach((t, i) => {
      const distance = Math.abs(t.offsetLeft - x)
      if (distance < bestDistance) [best, bestDistance] = [i, distance]
    })
    return best
  }
  // The pill position that centers it under the finger, kept between the first and last tab.
  const fingerX = (e: PointerEvent<HTMLElement>) => {
    const nav = e.currentTarget
    const tabs = tabEls()
    const x = e.clientX - nav.getBoundingClientRect().left - nav.clientLeft - (pill?.width ?? 0) / 2
    return Math.min(Math.max(x, tabs.at(0)?.offsetLeft ?? 0), tabs.at(-1)?.offsetLeft ?? 0)
  }

  const step = (now: number) => {
    const s = spring.current
    const el = pillRef.current
    if (!s || !el) return
    const dt = Math.min((now - s.last) / 1000, 1 / 30)
    s.last = now
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      s.x = s.target
      s.v = 0
    } else {
      // Loose while following the finger; quicker and snappier when let go.
      const [stiffness, damping] = s.release ? [520, 34] : [170, 19]
      s.v += (stiffness * (s.target - s.x) - damping * s.v) * dt
      s.x += s.v * dt
    }
    el.style.translate = `${s.x}px 0`
    setUnder(nearestTab(s.x))
    // Let go and arrived: hand the pill back to CSS, which finishes any last pixel of the settle.
    if (s.release && Math.abs(s.target - s.x) < 2) {
      el.style.translate = `${s.target}px 0`
      spring.current = null
      setDriven(false)
      setUnder(null)
      return
    }
    frame.current = requestAnimationFrame(step)
  }
  const moveTo = (target: number, release: boolean) => {
    if (spring.current) {
      Object.assign(spring.current, { target, release })
      return
    }
    // Start from wherever the pill is now, even partway through a CSS slide.
    const from = parseFloat(pillRef.current ? getComputedStyle(pillRef.current).translate : '') || 0
    spring.current = { x: from, v: 0, target, release, last: performance.now() }
    setDriven(true)
    frame.current = requestAnimationFrame(step)
  }

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !pill || pointerId.current !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerId.current = e.pointerId
    setHeld(true)
    moveTo(fingerX(e), false)
  }
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerId === pointerId.current) moveTo(fingerX(e), false)
  }
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerId !== pointerId.current) return
    pointerId.current = null
    setHeld(false)
    // The tab opens now; the pill catches up.
    const i = nearestTab(fingerX(e))
    const tab = TABS[i]
    if (tab && !tabEls()[i]?.classList.contains('active')) {
      // Back to where that tab was left (a kept tab), or its first page.
      const keptTab = keptTabOf(tab.to)
      const left = keptTab ? kept.saved[keptTab] : undefined
      navigate(left ? left.pathname + left.search : tab.to)
    }
    moveTo(tabEls()[i]?.offsetLeft ?? 0, true)
  }
  // Interrupted (the system took the touch): back to the selected tab, opening nothing.
  const onPointerCancel = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerId !== pointerId.current) return
    pointerId.current = null
    setHeld(false)
    if (pill) moveTo(pill.x, true)
  }

  return (
    <div className={`app ${onFlight ? '' : 'app--tabbar'}`}>
      <KeptTabs {...kept} />
      {/* The other tabs' maps, built ahead so their first visit shows them drawn. */}
      <MapPreloader open={Object.keys(kept.saved)} />
      <nav
        ref={navRef}
        className={`${styles.tabbar} ${onFlight ? styles.tabbarHidden : ''}`}
        aria-label="Main"
        inert={onFlight}
        data-no-press // the bar has its own press: the pill (see lib/buttonPress)
        data-dragging={driven || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
        // Taps and clicks open tabs through the gesture above; the links' own clicks are only
        // for the keyboard (Enter on a focused tab, a click with detail 0).
        onClickCapture={(e) => e.detail !== 0 && e.preventDefault()}
      >
        {pill && (
          <span
            ref={pillRef}
            aria-hidden
            className={[
              styles.indicator,
              animated && styles.indicatorAnimated,
              driven && styles.indicatorDriven,
              held && styles.indicatorHeld,
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ width: pill.width, opacity: hasSelection || driven ? 1 : 0 }}
          />
        )}
        {TABS.map(({ to, label, icon: Icon }, i) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={styles.tab}
            aria-label={label}
            title={label}
            data-under={under === i || undefined}
            draggable={false} // a mouse drag moves the pill, not the link
          >
            <Icon size={30} strokeWidth={1.75} aria-hidden />
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

// Full-screen pages: log flight, friends, settings, login.
export function BareLayout() {
  return (
    <div className="app">
      <Outlet />
    </div>
  )
}
