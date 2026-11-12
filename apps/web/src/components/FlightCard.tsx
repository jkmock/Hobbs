import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Gauge, GraduationCap, Moon, Plane, Route, User, type LucideIcon } from 'lucide-react'
import type { Flight } from '../lib/types'
import { formatDate, formatHours } from '../lib/format'
import LiveRouteMap from './LiveRouteMap'
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
  | 'crossCountryTime'
  | 'nightTime'
  | 'nightLandingsFs'
  | 'nightLandingsTg'
  | 'actualInstrumentTime'
  | 'simulatedInstrumentTime'
>

type Props = {
  flight: FlightSummary
  pilot?: string // shown in the social feed
  to?: string // makes the card a link
  footer?: ReactNode
  navy?: boolean // navy background with white text
}

export default function FlightCard({ flight, pilot, to, footer, navy }: Props) {
  const tags = tagsFor(flight)
  const [chartOpen, setChartOpen] = useState(false)
  const first = flight.legs[0]
  const last = flight.legs.at(-1)
  const routeName = first && last ? `${first.origin} to ${last.destination}` : 'Flight'

  return (
    <article className={`card ${styles.card} ${navy ? 'card--navy' : ''}`}>
      {/* The link covers the whole card; the map button and footer sit above it. */}
      {to && <Link to={to} className={styles.cover} aria-label={`${routeName}, ${formatDate(flight.flightDate)}`} />}
      <div className={styles.body}>
      <p className={styles.meta}>
        {pilot && <strong>{pilot}</strong>}
        <span>{formatDate(flight.flightDate)}</span>
        <span className={`mono ${styles.tail}`}>
          <Plane size={14} strokeWidth={1.75} aria-hidden />
          {flight.tailNumber}
        </span>
      </p>
      <RouteHeader flight={flight} />
      {flight.legs.length > 0 && (
        <button
          type="button"
          className={styles.mapButton}
          onClick={() => setChartOpen(true)}
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
      {footer && <div className={styles.footer}>{footer}</div>}
      {chartOpen && (
        <Suspense fallback={null}>
          <ChartViewer legs={flight.legs} title={routeName} onClose={() => setChartOpen(false)} />
        </Suspense>
      )}
    </article>
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
      <div className={styles.route}>
        <span className={`mono ${styles.ident}`}>{first.origin}</span>
        <span className={styles.rule}>
          <span className="mono">
            {formatHours(flight.totalTime)} h{distance > 0 && ` · ${distance} nm`}
            {isLocal && ' · local'}
          </span>
        </span>
        <span className={`mono ${styles.ident}`}>{last.destination}</span>
      </div>
      {stops.length > 0 && <p className={styles.via}>via {stops.join(', ')}</p>}
    </div>
  )
}

function tagsFor(f: FlightSummary): { icon: LucideIcon; label: string }[] {
  const tags: { icon: LucideIcon; label: string }[] = []
  if (f.dualReceivedTime > 0) tags.push({ icon: GraduationCap, label: 'Dual' })
  if (f.soloTime > 0) tags.push({ icon: User, label: 'Solo' })
  else if (f.picTime > 0) tags.push({ icon: User, label: 'PIC' })
  if (f.crossCountryTime > 0) tags.push({ icon: Route, label: 'Cross-country' })
  const nightLandings = f.nightLandingsFs + f.nightLandingsTg
  if (nightLandings > 0) tags.push({ icon: Moon, label: nightLandings === 1 ? 'Night landing' : `${nightLandings} night landings` })
  else if (f.nightTime > 0) tags.push({ icon: Moon, label: 'Night' })
  if (f.actualInstrumentTime + f.simulatedInstrumentTime > 0) tags.push({ icon: Gauge, label: 'Instrument' })
  return tags
}
