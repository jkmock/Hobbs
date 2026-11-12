import { Check } from 'lucide-react'
import { useRecentFlights } from '../../hooks/useLookups'
import { ApiError } from '../../lib/api'
import type { RecentFlight } from '../../lib/types'
import { emptyLeg, type DraftLeg, type StepProps } from './draft'
import styles from './LogFlight.module.css'

// "N123AB's Recent Flights": flights FlightAware saw for the chosen aircraft.
// Picking one or more turns them into the route's legs (in the order flown) and sets the date;
// picking none leaves the route to be entered by hand.
export default function RecentFlights({ draft, update }: Pick<StepProps, 'draft' | 'update'>) {
  const recent = useRecentFlights(draft.tailNumber)
  const flights = recent.data ?? []
  const selectedIds = new Set(draft.legs.flatMap((leg) => (leg.faFlightId ? [leg.faFlightId] : [])))

  function toggle(flight: RecentFlight) {
    const next = new Set(selectedIds)
    if (next.has(flight.faFlightId)) next.delete(flight.faFlightId)
    else next.add(flight.faFlightId)

    // Legs imported earlier that aren't in this list (an older flight being edited) stay put.
    const listed = new Set(flights.map((f) => f.faFlightId))
    const kept = draft.legs.filter((leg) => leg.faFlightId && !listed.has(leg.faFlightId))
    const picked = flights
      .filter((f) => next.has(f.faFlightId))
      .sort((a, b) => a.departedAt.localeCompare(b.departedAt))
    const imported: DraftLeg[] = picked.map((f) => ({
      origin: f.origin ?? '',
      destination: f.destination ?? '',
      // Takeoff to landing, so a little under the Hobbs time; the pilot can adjust it.
      time: f.arrivedAt ? airHours(f.departedAt, f.arrivedAt).toFixed(1) : '',
      faFlightId: f.faFlightId,
    }))

    const legs = [...kept, ...imported]
    const first = picked[0]
    update({
      legs: legs.length > 0 ? legs : [emptyLeg()],
      ...(first && { flightDate: localDate(first.departedAt) }),
    })
  }

  return (
    <section className={`card ${styles.panel}`}>
      <div className={styles.panelHead}>
        <h2>
          <span className="mono">{draft.tailNumber}</span>'s Recent Flights
        </h2>
      </div>

      {recent.isPending && <p className="muted" style={{ fontSize: 14 }}>Checking FlightAware…</p>}

      {recent.isError && (
        <p className="muted" style={{ fontSize: 14 }}>
          {errorMessage(recent.error)}
        </p>
      )}

      {recent.isSuccess && flights.length === 0 && (
        <p className="muted" style={{ fontSize: 14 }}>
          FlightAware has no flights for this aircraft in the last 10 days. Enter the route by hand.
        </p>
      )}

      {flights.length > 0 && (
        <>
          <ul className={styles.optionList}>
            {flights.map((f) => {
              const isSelected = selectedIds.has(f.faFlightId)
              return (
                <li key={f.faFlightId}>
                  <button
                    type="button"
                    className={styles.recentFlight}
                    aria-pressed={isSelected}
                    onClick={() => toggle(f)}
                  >
                    <span className={styles.checkbox} data-checked={isSelected || undefined} aria-hidden>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </span>
                    <span className={styles.recentRoute}>
                      <span className="mono">
                        {f.originCode ?? '?'} → {f.destinationCode ?? '?'}
                      </span>
                      <span className={styles.recentWhen}>{formatWhen(f)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function errorMessage(error: Error): string {
  if (error instanceof ApiError && error.status === 503) {
    return 'No recent flights found. Enter flight manually.'
  }
  if (error instanceof ApiError && error.status === 429) {
    const body = error.body as { resetsOn?: string } | null
    const resets = body?.resetsOn
      ? new Date(`${body.resetsOn}T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
      : 'the 1st'
    return `This month's FlightAware budget is used up, so enter the route by hand. It resets on ${resets}.`
  }
  return "Couldn't load flights from FlightAware. You can enter the route by hand."
}

// The departure's calendar date where the pilot is, as YYYY-MM-DD.
function localDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA')
}

const airHours = (from: string, to: string) =>
  Math.round(((new Date(to).getTime() - new Date(from).getTime()) / 3_600_000) * 10) / 10

function formatWhen(f: RecentFlight): string {
  const departed = new Date(f.departedAt)
  const date = departed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const time = departed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (!f.arrivedAt) return `${date} · ${time}`
  return `${date} · ${time} · ${airHours(f.departedAt, f.arrivedAt).toFixed(1)} h`
}
