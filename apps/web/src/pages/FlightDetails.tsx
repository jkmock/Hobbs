import { lazy, Suspense, useState, type CSSProperties } from 'react'
import { RouteLine } from '../components/FlightCard'
import LiveRouteMap from '../components/LiveRouteMap'
import { touchAndGoAirports } from '../lib/geo'
import { formatHours } from '../lib/format'
import type { Flight, Leg } from '../lib/types'
import { usePress } from '../hooks/usePress'
import styles from './FlightDetails.module.css'

// The chart library is large, so it loads only when someone opens a chart.
const ChartViewer = lazy(() => import('../components/ChartViewer'))

// A flight's details, shown under its card on the flight page (in FlightsPage): a card per
// leg, and cards of its times and landings and its notes.
//
// Each section pops in when this appears: a quick fade and grow, one after another (see .group
// in FlightDetails.module.css).
type Props = {
  flight: Flight
  delay?: number // ms before the first section pops in
  className?: string
}

export default function FlightDetails({ flight, delay = 100, className = '' }: Props) {
  const press = usePress() // the cards press and pop for fun
  const multiLeg = flight.legs.length > 1
  // Sections pop in one after another, in the order they appear: one leg's touch-and-goes,
  // or each leg (with its touch-and-goes), then Stats and Notes.
  const singleLegCards = multiLeg ? [] : touchAndGoCards(flight.legs[0])
  const statsOrder = multiLeg ? flight.legs.length : singleLegCards.length
  return (
    <div className={`stack ${styles.cards} ${className}`} style={{ '--pop-start': `${delay}ms` } as CSSProperties}>
      {/* With one leg, the flight's card above is the leg, so its touch-and-goes come first. */}
      {singleLegCards.map((card, i) => (
        <section key={i} className={styles.group} style={popOrder(i)}>
          <TouchAndGoCard {...card} />
        </section>
      ))}

      {multiLeg &&
        flight.legs.map((leg, i) => (
          <section key={leg.order} className={styles.group} style={popOrder(i)}>
            <h2 className={styles.label}>Leg {i + 1}:</h2>
            <LegCard leg={leg} />
            {/* The leg's touch-and-goes, right after its card. */}
            {touchAndGoCards(leg).map((card, j) => (
              <TouchAndGoCard key={j} {...card} />
            ))}
          </section>
        ))}

      <section className={styles.group} style={popOrder(statsOrder)}>
        <h2 className={styles.label}>Stats:</h2>
        <dl className={`card ${styles.stats}`} {...press}>
          {statsFor(flight).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="mono">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {flight.notes && (
        <section className={styles.group} style={popOrder(statsOrder + 1)}>
          <h2 className={styles.label}>Notes:</h2>
          <p className={`card ${styles.notes}`} {...press}>
            {flight.notes}
          </p>
        </section>
      )}
    </div>
  )
}

// A card per airport where touch-and-goes were flown during the leg, in the order flown, with
// how many in a row (stops in a row at the same airport are put together).
function touchAndGoCards(leg: Leg | undefined): { airport: string; count: number }[] {
  const cards: { airport: string; count: number }[] = []
  for (const stop of leg?.stops ?? []) {
    const last = cards.at(-1)
    if (last?.airport === stop.airport) last.count += stop.touchAndGoes
    else cards.push({ airport: stop.airport, count: stop.touchAndGoes })
  }
  return cards
}

// Touch-and-goes at one airport: the airport, and "Touch and Go" (or "2x Touch and Go")
// under it, centered.
function TouchAndGoCard({ airport, count }: { airport: string; count: number }) {
  const press = usePress() // press and pop it for fun
  return (
    <div className={`card ${styles.touchAndGo}`} {...press}>
      <span className={styles.touchAndGoCode}>{airport}</span>
      <span className={styles.touchAndGoLabel}>{count > 1 ? `${count}x ` : ''}Touch and Go</span>
    </div>
  )
}

// One leg: its route line, and a mini map of just that leg that opens the chart, like the
// flight card's map.
function LegCard({ leg }: { leg: Leg }) {
  const press = usePress() // press and pop it for fun
  const [chartFrom, setChartFrom] = useState<HTMLElement | null>(null) // the map tapped, while open
  const name = `${leg.origin} to ${leg.destination}`
  return (
    <div className={`card ${styles.leg}`} {...press}>
      <RouteLine origin={leg.origin} destination={leg.destination} summary={legSummary(leg.time, leg.distanceNm)} />
      <button
        type="button"
        className={styles.mapButton}
        onClick={(e) => setChartFrom(e.currentTarget)}
        // Tapping the map opens it; neither the map nor the leg card around it presses and pops.
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`Open ${name} on the map`}
        data-no-press
      >
        <LiveRouteMap legs={[leg]} airports={touchAndGoAirports([leg])} />
      </button>
      {chartFrom && (
        <Suspense fallback={null}>
          <ChartViewer legs={[leg]} airports={touchAndGoAirports([leg])} title={name} from={chartFrom} onClose={() => setChartFrom(null)} />
        </Suspense>
      )}
    </div>
  )
}

// The section's place in the pop-in order.
function popOrder(i: number) {
  return { '--pop-order': i } as CSSProperties
}

function legSummary(time: number | null | undefined, distanceNm: number) {
  const parts = []
  if (time) parts.push(`${formatHours(time)} h`)
  const nm = Math.round(distanceNm)
  if (nm > 0) parts.push(`${nm} nm`)
  return parts.join(' · ') || undefined
}

// Total time always; everything else only when the flight has some.
function statsFor(f: Flight): [string, string][] {
  const rows: [string, string][] = [['Total time', `${formatHours(f.totalTime)} h`]]
  const hours = (label: string, value: number) => value > 0 && rows.push([label, `${formatHours(value)} h`])
  const count = (label: string, value: number) => value > 0 && rows.push([label, String(value)])

  hours('PIC', f.picTime)
  hours('SIC', f.sicTime)
  hours('Solo', f.soloTime)
  hours('Dual received', f.dualReceivedTime)
  hours('Cross-country', f.crossCountryTime)
  hours('Night', f.nightTime)
  hours('Actual instrument', f.actualInstrumentTime)
  hours('Simulated instrument', f.simulatedInstrumentTime)
  count('Day landings (full stop)', f.dayLandingsFs)
  count('Day landings (touch and go)', f.dayLandingsTg)
  count('Night landings (full stop)', f.nightLandingsFs)
  count('Night landings (touch and go)', f.nightLandingsTg)
  count('Instrument approaches', f.instrumentApproaches)
  if (f.departureTime) rows.push(['Departed', f.departureTime])
  if (f.arrivalTime) rows.push(['Arrived', f.arrivalTime])
  if (f.instructorName) rows.push(['Instructor', f.instructorName])
  return rows
}
