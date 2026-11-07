import { ArrowRight, Plus, X } from 'lucide-react'
import RouteMap from '../../components/RouteMap'
import type { Airport } from '../../lib/types'
import { useLegDistances, type DraftLeg, type StepProps } from './draft'
import styles from './LogFlight.module.css'

export default function RouteStep({ draft, update, errors }: StepProps) {
  const { find, distances } = useLegDistances(draft.legs)

  const setLeg = (index: number, patch: Partial<DraftLeg>) =>
    update({ legs: draft.legs.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)) })

  // A new leg starts where the last one ended.
  const addLeg = () =>
    update({ legs: [...draft.legs, { origin: draft.legs.at(-1)?.destination ?? '', destination: '' }] })

  const removeLeg = (index: number) => update({ legs: draft.legs.filter((_, i) => i !== index) })

  // Preview the route once every airport is known.
  const resolved = draft.legs.map((leg) => ({ leg, a: find(leg.origin), b: find(leg.destination) }))
  const preview = resolved.every((r) => r.a && r.b)
    ? resolved.map(({ leg, a, b }) => ({
        origin: leg.origin.toUpperCase(),
        destination: leg.destination.toUpperCase(),
        originPoint: { lat: a!.latitude, lon: a!.longitude },
        destinationPoint: { lat: b!.latitude, lon: b!.longitude },
      }))
    : null

  return (
    <>
      {draft.legs.map((leg, i) => {
        const nm = distances[i]
        return (
          <section key={i} className={`card ${styles.leg}`}>
            <div className={styles.panelHead}>
              <span className="muted" style={{ fontSize: 13, fontWeight: 550 }}>
                Leg {i + 1}
              </span>
              {draft.legs.length > 1 && (
                <button type="button" className="icon-btn" aria-label={`Remove leg ${i + 1}`} onClick={() => removeLeg(i)}>
                  <X size={18} />
                </button>
              )}
            </div>
            <div className={styles.legRow}>
              <AirportField
                label="From"
                value={leg.origin}
                airport={find(leg.origin)}
                error={errors[`legs.${i}.origin`]}
                onChange={(origin) => setLeg(i, { origin })}
              />
              <ArrowRight size={18} aria-hidden />
              <AirportField
                label="To"
                value={leg.destination}
                airport={find(leg.destination)}
                error={errors[`legs.${i}.destination`]}
                onChange={(destination) => setLeg(i, { destination })}
              />
            </div>
            {nm != null && (
              <p className={styles.legMeta}>
                <span className="mono">{Math.round(nm)} nm</span>
                {nm > 50 && <strong> · over 50 nm, counts as cross-country</strong>}
                {nm === 0 && ' · local flight'}
              </p>
            )}
          </section>
        )
      })}

      {errors.legs && <p className="error-text">{errors.legs}</p>}

      {draft.legs.length < 20 && (
        <button type="button" className="btn btn--ghost" onClick={addLeg} style={{ alignSelf: 'center' }}>
          <Plus size={16} /> Add another leg
        </button>
      )}

      {preview && (
        <div className="card" style={{ padding: 6 }}>
          <RouteMap legs={preview} height={170} />
        </div>
      )}
    </>
  )
}

type AirportFieldProps = {
  label: string
  value: string
  airport: Airport | null | undefined
  error?: string
  onChange: (value: string) => void
}

function AirportField({ label, value, airport, error, onChange }: AirportFieldProps) {
  return (
    <label className="field" style={{ minWidth: 0 }}>
      <span>{label}</span>
      <input
        className={`input ${styles.airportInput}`}
        value={value}
        maxLength={10}
        placeholder="KRDU"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
      <span className={styles.airportName}>
        {error ? (
          <span className="error-text">{error}</span>
        ) : airport === null ? (
          <span className="error-text">Unknown airport</span>
        ) : (
          airport?.name
        )}
      </span>
    </label>
  )
}
