import { lazy, Suspense, useState } from 'react'
import { Expand, Plus, X } from 'lucide-react'
import LiveRouteMap from '../../components/LiveRouteMap'
import { Stepper } from '../../components/controls'
import { useFlightTracks } from '../../hooks/useLookups'
import type { Airport } from '../../lib/types'
import { textWidth, useFontsReady } from '../../lib/textWidth'
import { emptyLeg, useLegDistances, type DraftLeg, type StepProps } from './draft'
import styles from './LogFlight.module.css'

// The chart library is large, so it loads only when someone opens the map.
const ChartViewer = lazy(() => import('../../components/ChartViewer'))

const FONT_SANS =getComputedStyle(document.documentElement).getPropertyValue('--font-sans') || 'sans-serif'

export default function RouteStep({ draft, update, errors, clearError }: StepProps) {
  const { find, distances } = useLegDistances(draft.legs)
  const [mapOpen, setMapOpen] = useState(false)
  // Legs picked from FlightAware are drawn along the path actually flown.
  const tracks = useFlightTracks(draft.legs.flatMap((leg) => (leg.faFlightId ? [leg.faFlightId] : [])))

  const setLeg = (index: number, patch: Partial<DraftLeg>) =>
    update({ legs: draft.legs.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)) })

  // A new leg starts where the last one ended.
  const addLeg = () =>
    update({ legs: [...draft.legs, emptyLeg({ origin: draft.legs.at(-1)?.destination ?? '' })] })

  const removeLeg = (index: number) => update({ legs: draft.legs.filter((_, i) => i !== index) })

  // Preview every leg whose two airports are known, so the map keeps showing the finished
  // legs while a new one is being typed.
  const preview = draft.legs.flatMap((leg) => {
    const a = find(leg.origin)
    const b = find(leg.destination)
    if (!a || !b) return []
    return [
      {
        origin: a.ident, // the code the app shows (RDU), whatever was typed
        destination: b.ident,
        originPoint: { lat: a.latitude, lon: a.longitude },
        destinationPoint: { lat: b.latitude, lon: b.longitude },
        // A straight (great-circle) line until the track arrives, or if there isn't one.
        track: leg.faFlightId ? tracks.get(leg.faFlightId) : undefined,
      },
    ]
  })

  // Airports of legs still missing their other end (the first one typed, say), marked on the
  // map as dots as soon as the code matches. They don't move the map; only finished legs do.
  const inPreview = new Set(preview.flatMap((leg) => [leg.origin, leg.destination]))
  const lone = new Map<string, { ident: string; point: { lat: number; lon: number } }>()
  for (const leg of draft.legs) {
    if (find(leg.origin) && find(leg.destination)) continue
    for (const airport of [find(leg.origin), find(leg.destination)]) {
      if (airport && !inPreview.has(airport.ident)) {
        lone.set(airport.ident, { ident: airport.ident, point: { lat: airport.latitude, lon: airport.longitude } })
      }
    }
  }
  const loneAirports = [...lone.values()]

  return (
    <>
      {/* Stays put above the legs, which scroll on their own. */}
      <div className={styles.routePreview}>
        <div className={`card ${styles.routePreviewCard}`}>
          {/* Shows the continental US until a leg's two airports are known. */}
          {/* Tapping the map opens it full screen to explore. It sits over this page, so
              the legs being entered stay as they are; the X closes it. */}
          <button type="button" className={styles.mapButton} onClick={() => setMapOpen(true)} aria-label="Open the route map full screen">
            <LiveRouteMap legs={preview} airports={loneAirports} height={170} />
            {/* Same full-screen badge as the Map page's preview. */}
            <span className={styles.mapExpand} aria-hidden>
              <Expand size={20} strokeWidth={2} />
            </span>
          </button>
        </div>
      </div>
      {mapOpen && (
        <Suspense fallback={null}>
          <ChartViewer legs={preview} airports={loneAirports} title="Route map" onClose={() => setMapOpen(false)} />
        </Suspense>
      )}
      <div className={styles.routeLegs}>
        {draft.legs.map((leg, i) => {
          const nm = distances[i]
          return (
            <div key={i} className={styles.legGroup}>
              {/* Above the card. The remove button only appears once there's a second leg. */}
              <div className={styles.legHead}>
                <span className={styles.legTitle}>Leg {i + 1}:</span>
                {draft.legs.length > 1 && (
                  <button type="button" className="icon-btn" aria-label={`Remove leg ${i + 1}`} onClick={() => removeLeg(i)}>
                    <X size={18} />
                  </button>
                )}
              </div>
            <section className={`card ${styles.leg}`}>
              <div className={styles.legTop}>
                <div className={styles.route}>
                  <AirportField
                    label="Origin"
                    align="start"
                    value={leg.origin}
                    problem={airportProblem(find(leg.origin), errors[`legs.${i}.origin`])}
                    onChange={(origin) => setLeg(i, { origin })}
                    onFocus={() => clearError(`legs.${i}.origin`)}
                  />
                  <div className={styles.routeMiddle}>
                    <span className={styles.routeLine}>
                      {/* Distance over the arrow, out of the layout so it moves nothing. */}
                      {nm != null && (
                        <span className={styles.routeDistance}>{nm === 0 ? 'Local' : `${Math.round(nm)} nm`}</span>
                      )}
                    </span>
                  </div>
                  <AirportField
                    label="Dest"
                    align="end"
                    value={leg.destination}
                    problem={airportProblem(find(leg.destination), errors[`legs.${i}.destination`])}
                    onChange={(destination) => setLeg(i, { destination })}
                    onFocus={() => clearError(`legs.${i}.destination`)}
                  />
                </div>
              </div>
              <div className={styles.legBottom}>
                <Stepper
                  label="Flight time"
                  // A new leg's time starts empty; show it as 0.0 like Total time.
                  value={leg.time === '' ? '0.0' : leg.time}
                  onChange={(time) => setLeg(i, { time })}
                  error={errors[`legs.${i}.time`]}
                  labelClassName={styles.stepLabelText}
                />
              </div>
            </section>
            </div>
          )
        })}

        {errors.legs && <p className="error-text">{errors.legs}</p>}

        {draft.legs.length < 20 && (
          <button type="button" className={`btn btn--ghost ${styles.addLeg}`} onClick={addLeg}>
            <Plus size={22} strokeWidth={2.25} aria-hidden /> Add another leg
          </button>
        )}
      </div>
    </>
  )
}

// Font of the airport code inputs (see .endpointInput), for measuring what's typed: each
// input is exactly as wide as its text plus an equal overhang on both sides, so the
// underline sticks out the same amount left and right.
const CODE_FONT = `700 30px ${FONT_SANS}`
const CODE_LETTER_SPACING = 0.3 // 0.01em at 30px
const CODE_UNDERLINE_OVERHANG = 4

type AirportFieldProps = {
  label: string
  align: 'start' | 'end'
  value: string
  problem: string | null // shown under the code, e.g. "Unknown airport"
  onChange: (value: string) => void
  onFocus: () => void // called only while the box is empty, to drop its "Enter a code"
}

function AirportField({ label, align, value, problem, onChange, onFocus }: AirportFieldProps) {
  useFontsReady() // measure again once the real font has loaded
  const width = CODE_UNDERLINE_OVERHANG * 2 + textWidth(value || 'RDU', CODE_FONT, CODE_LETTER_SPACING)
  return (
    <label className={styles.endpoint} data-align={align}>
      <span className={styles.endpointLabel}>{label}</span>
      <span className={styles.codeBox}>
      <input
        className={styles.endpointInput}
        value={value}
        maxLength={10}
        placeholder="RDU"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        aria-label={`${label} airport`}
        aria-invalid={!!problem}
        style={{ width }}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        // Clicking into an empty box clears its "Enter a code" right away.
        onFocus={() => {
          if (value === '') onFocus()
        }}
      />
      {/* Positioned out of the layout, so a message never pushes Flight Time down. */}
      {problem && <span className={`error-text ${styles.airportProblem}`}>{problem}</span>}
      </span>
    </label>
  )
}

// Why an airport code can't be used, if it can't. The airport's name isn't shown.
// Kept short: it has one line under the code.
function airportProblem(airport: Airport | null | undefined, error?: string): string | null {
  if (error) return 'Enter a code'
  return airport === null ? 'Unknown airport' : null
}
