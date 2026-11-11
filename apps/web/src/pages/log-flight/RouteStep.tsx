import { Plus, X } from 'lucide-react'
import RouteMap from '../../components/RouteMap'
import type { Airport } from '../../lib/types'
import { textWidth, useFontsReady } from '../../lib/textWidth'
import { emptyLeg, useLegDistances, type DraftLeg, type StepProps } from './draft'
import styles from './LogFlight.module.css'

const FONT_SANS = getComputedStyle(document.documentElement).getPropertyValue('--font-sans') || 'sans-serif'

export default function RouteStep({ draft, update, errors }: StepProps) {
  const { find, distances } = useLegDistances(draft.legs)

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
      },
    ]
  })

  return (
    <>
      {/* Pinned to the top while the legs scroll under it. Before any leg is complete it holds
          its place with an empty frame, so nothing jumps when the route first appears. */}
      <div className={styles.routePreview}>
        <div className={`card ${styles.routePreviewCard}`}>
          {preview.length > 0 ? (
            <RouteMap legs={preview} height={170} />
          ) : (
            <p className={styles.routePreviewEmpty}>Your route will show here</p>
          )}
        </div>
      </div>
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
          <section className={`card card--navy ${styles.leg}`}>
            <div className={styles.route}>
              <AirportField
                label="Origin"
                align="start"
                value={leg.origin}
                problem={airportProblem(find(leg.origin), errors[`legs.${i}.origin`])}
                onChange={(origin) => setLeg(i, { origin })}
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
              />
            </div>
            {/* Its own row, centered on the card, so it stays put whatever the codes' widths. */}
            <label className={styles.legTime}>
              Flight Time:
              <input
                className={styles.legTimeInput}
                inputMode="decimal"
                placeholder="0.0"
                value={leg.time}
                onChange={(e) => setLeg(i, { time: e.target.value })}
                aria-invalid={!!errors[`legs.${i}.time`]}
                style={{ width: TIME_UNDERLINE_OVERHANG * 2 + textWidth(leg.time || '0.0', TIME_FONT) }}
              />
            </label>
            {errors[`legs.${i}.time`] && <p className="error-text">{errors[`legs.${i}.time`]}</p>}
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

    </>
  )
}

// Fonts of the code and time inputs (see .endpointInput and .legTimeInput), for measuring
// what's typed: each input is exactly as wide as its text plus an equal overhang on both
// sides, so the underline sticks out the same amount left and right.
const CODE_FONT = `700 30px ${FONT_SANS}`
const CODE_LETTER_SPACING = 0.3 // 0.01em at 30px
const CODE_UNDERLINE_OVERHANG = 4
const TIME_FONT = `700 24px ${FONT_SANS}`
const TIME_UNDERLINE_OVERHANG = 3

type AirportFieldProps = {
  label: string
  align: 'start' | 'end'
  value: string
  problem: string | null // shown under the code, e.g. "Unknown airport"
  onChange: (value: string) => void
}

function AirportField({ label, align, value, problem, onChange }: AirportFieldProps) {
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
