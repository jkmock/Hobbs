import { lazy, Suspense, useState, type CSSProperties } from 'react'
import { RouteLine } from '../components/FlightCard'
import LiveRouteMap from '../components/LiveRouteMap'
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
  const legCards = flight.legs.length > 1 ? flight.legs.length : 0
  return (
    <div className={`stack ${styles.cards} ${className}`} style={{ '--pop-start': `${delay}ms` } as CSSProperties}>
      {flight.legs.length > 1 &&
        flight.legs.map((leg, i) => (
          <section key={leg.order} className={styles.group} style={popOrder(i)}>
            <h2 className={styles.label}>Leg {i + 1}:</h2>
            <LegCard leg={leg} />
          </section>
        ))}

      <section className={styles.group} style={popOrder(legCards)}>
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
        <section className={styles.group} style={popOrder(legCards + 1)}>
          <h2 className={styles.label}>Notes:</h2>
          <p className={`card ${styles.notes}`} {...press}>
            {flight.notes}
          </p>
        </section>
      )}
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
      <button type="button" className={styles.mapButton} onClick={(e) => setChartFrom(e.currentTarget)} aria-label={`Open ${name} on the map`}>
        <LiveRouteMap legs={[leg]} />
      </button>
      {chartFrom && (
        <Suspense fallback={null}>
          <ChartViewer legs={[leg]} title={name} from={chartFrom} onClose={() => setChartFrom(null)} />
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
