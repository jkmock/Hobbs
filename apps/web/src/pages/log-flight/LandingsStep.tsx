import { Stepper } from '../../components/controls'
import { LANDING_FIELDS, type StepProps } from './draft'
import styles from './LogFlight.module.css'

export default function LandingsStep({ draft, update, errors }: StepProps) {
  return (
    <>
      <section className={`card ${styles.panel}`} style={{ gap: 0 }}>
        {LANDING_FIELDS.map(([key, label]) => (
          <Stepper
            key={key}
            label={label}
            value={draft.landings[key]}
            step={1}
            max={99}
            error={errors[key]}
            onChange={(value) => update({ landings: { ...draft.landings, [key]: value } })}
          />
        ))}
      </section>

      <label className="field">
        <span>Notes</span>
        <textarea
          className="input"
          value={draft.notes}
          maxLength={500}
          placeholder="Steep turns, slow flight, first solo…"
          onChange={(e) => update({ notes: e.target.value })}
        />
        {errors.notes && <span className="error-text">{errors.notes}</span>}
      </label>
    </>
  )
}
