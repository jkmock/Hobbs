import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent, type ReactNode, type Ref } from 'react'
import { Link } from 'react-router'
import { Gauge, GraduationCap, MessageCircle, Moon, Plane, Route, Star, User, type LucideIcon } from 'lucide-react'
import type { Flight } from '../lib/types'
import { formatDate, formatHours } from '../lib/format'
import { pressIn, release } from '../lib/press'
import { usePress } from '../hooks/usePress'
import LiveRouteMap from './LiveRouteMap'
import { Avatar } from './controls'
import styles from './FlightCard.module.css'

// The chart library is large, so it loads only when someone opens a chart.
const ChartViewer = lazy(() => import('./ChartViewer'))

// The fields a card needs. Real flights and the sample social feed both fit this shape.
export type FlightSummary = Pick<
  Flight,
  | 'flightDate'
  | 'totalTime'
  | 'tailNumber'
  | 'legs'
  | 'dualReceivedTime'
  | 'soloTime'
  | 'picTime'
  | 'sicTime'
  | 'crossCountryTime'
  | 'nightTime'
  | 'nightLandingsFs'
  | 'nightLandingsTg'
  | 'actualInstrumentTime'
  | 'simulatedInstrumentTime'
>

type Props = {
  flight: FlightSummary
  pilot?: { firstName: string; lastName: string } // whose flight, in the social feed
  to?: string // makes the card a link
  footer?: ReactNode
  below?: ReactNode // inside the card, under the footer (e.g. the comments)
  belowOpen?: boolean // `below` slides open and closed with this (shown when left out)
  navy?: boolean // navy background with white text
  className?: string
  cardRef?: Ref<HTMLElement>
  pressable?: boolean // press and pop it for fun (for a card that isn't a link)
}

export default function FlightCard({ flight, pilot, to, footer, below, belowOpen = true, navy, className = '', cardRef, pressable = false }: Props) {
  const pressHandlers = usePress()
  const tags = tagsFor(flight)
  const [chartFrom, setChartFrom] = useState<HTMLElement | null>(null) // the map tapped, while open
  const first = flight.legs[0]
  const last = flight.legs.at(-1)
  const routeName = first && last ? `${first.origin} to ${last.destination}` : 'Flight'

  return (
    <article
      ref={cardRef}
      className={`card ${styles.card} ${navy ? 'card--navy' : ''} ${className}`}
      {...(pressable && !to ? pressHandlers : {})}
    >
      {/* The link covers the whole card; the map button and footer sit above it. */}
      {to && <CoverLink to={to} label={`${routeName}, ${formatDate(flight.flightDate)}`} />}
      <div className={styles.body}>
      {pilot && (
        <p className={styles.pilot}>
          <Avatar firstName={pilot.firstName} lastName={pilot.lastName} size={32} />
          {pilot.firstName} {pilot.lastName}
        </p>
      )}
      <p className={styles.meta}>
        <span className={styles.date}>{formatDate(flight.flightDate)}</span>
        <span className={`tail-number ${styles.tail}`}>
          <Plane size={18} strokeWidth={1.75} aria-hidden />
          {flight.tailNumber}
        </span>
      </p>
      <RouteHeader flight={flight} />
      {flight.legs.length > 0 && (
        <button
          type="button"
          className={styles.mapButton}
          onClick={(e) => setChartFrom(e.currentTarget)}
          // Tapping the map opens it; it doesn't press and pop the card around it.
          onPointerDown={stopPress}
          aria-label={`Open ${routeName} on the map`}
        >
          <LiveRouteMap legs={flight.legs} />
        </button>
      )}
      {tags.length > 0 && (
        <ul className={styles.tags}>
          {tags.map(({ icon: Icon, label }) => (
            <li key={label}>
              <Icon size={14} strokeWidth={1.75} aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      )}
      </div>
      {/* Props and comments are controls of their own: pressing them doesn't press and pop
          the card around them. */}
      {footer && (
        <div className={styles.footer} onPointerDown={stopPress}>
          {footer}
        </div>
      )}
      {/* Kept while closed so it can slide shut as well as open. */}
      {below && (
        <div className={styles.belowSlide} data-open={belowOpen} inert={!belowOpen} onPointerDown={stopPress}>
          <div className={styles.belowClip}>
            <div className={styles.below}>{below}</div>
          </div>
        </div>
      )}
      {chartFrom && (
        <Suspense fallback={null}>
          <ChartViewer legs={flight.legs} title={routeName} from={chartFrom} onClose={() => setChartFrom(null)} />
        </Suspense>
      )}
    </article>
  )
}

// Keeps a press on a control inside the card from pressing the card itself.
const stopPress = (e: PointerEvent) => e.stopPropagation()

// A hold longer than this isn't a tap: letting go just releases the card.
const LONG_PRESS_MS = 450
const MOVE_SLOP = 8 // px a finger can drift and still be a tap
// A finger waits this long, without moving, before the card presses in, so the start of a
// scroll never does. (A mouse presses straight away; it can't be scrolling.)
const PRESS_DELAY_MS = 90

type Touch = { x: number; y: number; at: number; cancelled: boolean; pressed: boolean; timer: number }

// The link that covers the whole card. Touching the card presses it in. A tap (a quick
// press and release) opens the link; holding longer, or moving (scrolling), lets the card
// spring back on release without opening anything.
function CoverLink({ to, label }: { to: string; label: string }) {
  const touch = useRef<Touch | null>(null)
  const suppressClick = useRef(false)
  useEffect(() => () => clearTimeout(touch.current?.timer), [])

  const card = (el: Element) => el.closest('article') as HTMLElement | null
  function press(t: Touch, el: Element) {
    clearTimeout(t.timer)
    if (t.pressed) return
    t.pressed = true
    const article = card(el)
    if (article) pressIn(article)
  }
  // Not a tap any more (moved, slid off, or the browser took over): spring back if pressed.
  function cancel(t: Touch, el: Element) {
    clearTimeout(t.timer)
    if (t.cancelled) return
    t.cancelled = true
    const article = card(el)
    if (t.pressed && article) release(article)
  }

  return (
    <Link
      to={to}
      className={styles.cover}
      aria-label={label}
      draggable={false}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        clearTimeout(touch.current?.timer)
        const t: Touch = { x: e.clientX, y: e.clientY, at: performance.now(), cancelled: false, pressed: false, timer: 0 }
        touch.current = t
        suppressClick.current = false
        const el = e.currentTarget
        if (e.pointerType === 'mouse') press(t, el)
        else t.timer = window.setTimeout(() => press(t, el), PRESS_DELAY_MS)
      }}
      onPointerMove={(e) => {
        const t = touch.current
        if (t && !t.cancelled && Math.hypot(e.clientX - t.x, e.clientY - t.y) > MOVE_SLOP) cancel(t, e.currentTarget)
      }}
      onPointerUp={(e) => {
        const t = touch.current
        touch.current = null
        if (!t) return
        if (t.cancelled || performance.now() - t.at > LONG_PRESS_MS) {
          suppressClick.current = true // the click that follows shouldn't open the flight
          if (!t.cancelled) cancel(t, e.currentTarget)
          return
        }
        // A tap: the click that follows opens the flight. The card stays pressed in (pressed
        // now, if the tap was quicker than the delay) for the opening animation to carry on from.
        press(t, e.currentTarget)
      }}
      onPointerLeave={(e) => {
        if (touch.current) cancel(touch.current, e.currentTarget) // slid off the card
      }}
      onPointerCancel={(e) => {
        if (touch.current) cancel(touch.current, e.currentTarget) // the browser took over (a scroll)
        touch.current = null
      }}
      onClick={(e) => {
        if (suppressClick.current) {
          e.preventDefault()
          suppressClick.current = false
        }
      }}
      onContextMenu={(e) => e.preventDefault()} // a long press is just a press, not a menu
    />
  )
}

// Props and Comments, for a card's footer. Hobbs doesn't store props or comments yet, so
// the counts are 0 except in the sample social feed. Each becomes a button when it has something to do (in the list, opening
// the flight; on the flight's page, opening its props or comments under the footer).
type ReactionsProps = {
  propsCount?: number
  commentsCount?: number
  propsOpen?: boolean
  commentsOpen?: boolean
  onComments?: () => void
  onProps?: () => void
}

export function FlightReactions({ propsCount = 0, commentsCount = 0, propsOpen, commentsOpen, onComments, onProps }: ReactionsProps = {}) {
  const props = (
    <>
      <Star size={16} strokeWidth={1.75} aria-hidden />
      <span className="mono">{propsCount}</span> Props
    </>
  )
  const comments = (
    <>
      <MessageCircle size={16} strokeWidth={1.75} aria-hidden />
      <span className="mono">{commentsCount}</span> Comments
    </>
  )
  return (
    <>
      {onProps ? (
        <button
          type="button"
          className={`btn btn--ghost btn--sm ${styles.reactionButton}`}
          onClick={onProps}
          aria-expanded={propsOpen}
        >
          {props}
        </button>
      ) : (
        <span className={`btn btn--ghost btn--sm ${styles.reaction}`}>{props}</span>
      )}
      {onComments ? (
        <button
          type="button"
          className={`btn btn--ghost btn--sm ${styles.reactionButton}`}
          onClick={onComments}
          aria-expanded={commentsOpen}
        >
          {comments}
        </button>
      ) : (
        <span className={`btn btn--ghost btn--sm ${styles.reaction}`}>{comments}</span>
      )}
    </>
  )
}

function RouteHeader({ flight }: { flight: FlightSummary }) {
  const first = flight.legs[0]
  const last = flight.legs.at(-1)
  if (!first || !last) return null

  const stops = flight.legs.slice(1).map((leg) => leg.origin)
  const distance = Math.round(flight.legs.reduce((nm, leg) => nm + leg.distanceNm, 0))
  const isLocal = flight.legs.length === 1 && first.origin === first.destination

  return (
    <div className={styles.routeBlock}>
      <RouteLine
        origin={first.origin}
        destination={last.destination}
        summary={`${formatHours(flight.totalTime)} h${distance > 0 ? ` · ${distance} nm` : ''}${isLocal ? ' · Local' : ''}`}
      />
      {stops.length > 0 && <p className={styles.via}>via {stops.join(', ')}</p>}
    </div>
  )
}

// Styled like a leg on the log-flight Route step: big blue codes and an arrow, with the
// summary (time and distance) where the Route step shows the distance.
export function RouteLine({ origin, destination, summary }: { origin: string; destination: string; summary?: string }) {
  return (
    <div className={styles.route}>
      <span className={styles.ident}>{origin}</span>
      <span className={styles.middle}>
        <span className={styles.line}>
          {summary && <span className={styles.summary}>{summary}</span>}
        </span>
      </span>
      <span className={styles.ident}>{destination}</span>
    </div>
  )
}

function tagsFor(f: FlightSummary): { icon: LucideIcon; label: string }[] {
  const tags: { icon: LucideIcon; label: string }[] = []
  if (f.dualReceivedTime > 0) tags.push({ icon: GraduationCap, label: 'Dual' })
  if (f.soloTime > 0) tags.push({ icon: User, label: 'Solo' })
  else if (f.picTime > 0) tags.push({ icon: User, label: 'PIC' })
  if (f.sicTime > 0) tags.push({ icon: User, label: 'SIC' })
  if (f.crossCountryTime > 0) tags.push({ icon: Route, label: 'Cross-country' })
  const nightLandings = f.nightLandingsFs + f.nightLandingsTg
  if (nightLandings > 0) tags.push({ icon: Moon, label: nightLandings === 1 ? 'Night landing' : `${nightLandings} night landings` })
  else if (f.nightTime > 0) tags.push({ icon: Moon, label: 'Night' })
  if (f.actualInstrumentTime + f.simulatedInstrumentTime > 0) tags.push({ icon: Gauge, label: 'Instrument' })
  return tags
}
