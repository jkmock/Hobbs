import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { Stepper } from '../../components/controls'
import { useDetectedTouchAndGoes } from '../../hooks/useLookups'
import type { Airport } from '../../lib/types'
import { textWidth, useFontsReady } from '../../lib/textWidth'
import { emptyLeg, useLegDistances, type DraftLeg, type StepProps } from './draft'
import styles from './LogFlight.module.css'

const FONT_SANS =getComputedStyle(document.documentElement).getPropertyValue('--font-sans') || 'sans-serif'

export default function RouteStep({ draft, update, errors, clearError }: StepProps) {
  const { find, distances } = useLegDistances(draft.legs)

  const setLeg = (index: number, patch: Partial<DraftLeg>) =>
    update({ legs: draft.legs.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)) })

  // A new leg starts where the last one ended.
  const addLeg = () =>
    update({ legs: [...draft.legs, emptyLeg({ origin: draft.legs.at(-1)?.destination ?? '' })] })

  const removeLeg = (index: number) => update({ legs: draft.legs.filter((_, i) => i !== index) })

  return (
    <>
      {/* The map above the legs is RoutePreview, which the flight form keeps loaded on every step. */}
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
                  // A new leg's time starts empty; the Stepper shows that as 0.0 like Total time.
                  value={leg.time}
                  onChange={(time) => setLeg(i, { time })}
                  error={errors[`legs.${i}.time`]}
                  labelClassName={styles.stepLabelText}
                />
              </div>
            </section>
            {leg.faFlightId && <TouchAndGoCards leg={leg} onChange={(patch) => setLeg(i, patch)} />}
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

// Under a leg imported from FlightAware: a card for each airport where the track suggests
// touch-and-goes, with how many (editable), to include in the leg or discard. A touch-and-go
// doesn't end the FlightAware flight, so they belong to this leg rather than new legs.
// Included ones are saved with the leg and added to the day touch-and-go landings.
function TouchAndGoCards({ leg, onChange }: { leg: DraftLeg; onChange: (patch: Partial<DraftLeg>) => void }) {
  const detected = useDetectedTouchAndGoes(leg.faFlightId)
  // Counts edited on cards not included yet, by airport.
  const [edited, setEdited] = useState<Record<string, string>>({})
  const stops = leg.stops ?? []
  const dismissed = new Set(leg.dismissedStops ?? [])
  const detectedCount = new Map((detected.data ?? []).map((d) => [d.airport, d.count]))

  // In the order flown: what the track found, then included ones it didn't (saved earlier).
  const airports = [...new Set([...(detected.data ?? []).map((d) => d.airport), ...stops.map((s) => s.airport)])]
  const cards = airports.flatMap((airport) => {
    const stop = stops.find((s) => s.airport === airport)
    if (stop) return [{ airport, count: stop.count, included: true }]
    if (dismissed.has(airport)) return []
    return [{ airport, count: edited[airport] ?? String(detectedCount.get(airport) ?? 1), included: false }]
  })
  if (cards.length === 0) return null

  const order = (airport: string) => airports.indexOf(airport)
  const setCount = (airport: string, count: string, included: boolean) => {
    if (!included) return setEdited({ ...edited, [airport]: count })
    onChange({ stops: stops.map((s) => (s.airport === airport ? { ...s, count } : s)) })
  }
  const include = (airport: string, count: string) =>
    onChange({ stops: [...stops, { airport, count }].sort((a, b) => order(a.airport) - order(b.airport)) })
  const discard = (airport: string) =>
    onChange({
      stops: stops.filter((s) => s.airport !== airport),
      dismissedStops: [...(leg.dismissedStops ?? []), airport],
    })

  return (
    <div className={styles.touchAndGoes}>
      {cards.map(({ airport, count, included }) => (
        <section key={airport} className={`card ${styles.leg}`} data-included={included || undefined}>
          <div className={`${styles.legTop} ${styles.touchAndGoTop}`}>
            <span className={styles.touchAndGoCode}>{airport}</span>
            {/* Once included, the "Detected…" line and the buttons fold away. */}
            <div className={styles.touchAndGoFold} inert={included}>
              <div>
                <span className={`${styles.endpointLabel} ${styles.touchAndGoLabel}`}>
                  Detected Touch and Go {Number(count) === 1 ? 'Landing' : 'Landings'}
                </span>
              </div>
            </div>
          </div>
          <div className={styles.legBottom}>
            <Stepper
              label="Touch and Go"
              value={count}
              step={1}
              max={99}
              onChange={(value) => setCount(airport, value, included)}
              labelClassName={styles.stepLabelText}
            />
          </div>
          <div className={styles.touchAndGoFold} inert={included}>
            <div>
              <div className={styles.touchAndGoActions}>
                <button type="button" className="btn" onClick={() => discard(airport)}>
                  Discard
                </button>
                <button type="button" className="btn btn--primary" disabled={included} onClick={() => include(airport, count)}>
                  {included ? (
                    <>
                      <Check size={16} strokeWidth={2.5} aria-hidden /> Included
                    </>
                  ) : (
                    'Include'
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
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
  const width = CODE_UNDERLINE_OVERHANG * 2 + textWidth(value || 'XXX', CODE_FONT, CODE_LETTER_SPACING)
  return (
    <label className={styles.endpoint} data-align={align}>
      <span className={styles.endpointLabel}>{label}</span>
      <span className={styles.codeBox}>
      <input
        className={styles.endpointInput}
        value={value}
        maxLength={10}
        placeholder="XXX"
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
