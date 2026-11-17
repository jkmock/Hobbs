import { Segmented, Stepper } from '../../components/controls'
import { LANDING_FIELDS, type StepProps, type Visibility } from './draft'
import styles from './LogFlight.module.css'

export default function LandingsStep({ draft, update, errors }: StepProps) {
  return (
    <>
      <section className={`card ${styles.panel} ${styles.landingsCard}`}>
        <h2 className={styles.cardTitle}>Landings</h2>
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

      <section className={`card ${styles.panel}`}>
        <h2 className={styles.cardTitle}>Visibility</h2>
        <Segmented<Visibility>
          label="Visibility"
          value={draft.visibility ?? 'public'}
          onChange={(visibility) => update({ visibility })}
          options={[
            { value: 'public', label: 'Public' },
            { value: 'private', label: 'Private' },
          ]}
        />
        <p className={`muted ${styles.visibilityNote}`}>
          {(draft.visibility ?? 'public') === 'public'
            ? 'Your friends can see this flight in their feed.'
            : 'Only you can see this flight.'}
        </p>
      </section>

      <section className={`card ${styles.panel}`}>
        <h2 className={styles.cardTitle}>Optional</h2>
        <label className="field">
          <span>Instructor</span>
          <input
            className="input"
            value={draft.instructorName}
            maxLength={100}
            autoComplete="off"
            autoCapitalize="words"
            onChange={(e) => update({ instructorName: e.target.value })}
          />
          {errors.instructorName && <span className="error-text">{errors.instructorName}</span>}
        </label>

        <label className="field">
          <span>Description</span>
          <textarea
            className="input"
            value={draft.notes}
            maxLength={500}
            onChange={(e) => update({ notes: e.target.value })}
          />
          {errors.notes && <span className="error-text">{errors.notes}</span>}
        </label>
      </section>
    </>
  )
}
