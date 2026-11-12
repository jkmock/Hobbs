import { Segmented, Stepper } from '../../components/controls'
import { draftLegTotal, TIME_FIELDS, type FlightType, type StepProps, type TimeField } from './draft'
import styles from './LogFlight.module.css'

export default function TimesStep({ draft, update, errors }: StepProps) {
  const t = draft.times
  const setTime = (key: TimeField, value: string) => update({ times: { ...t, [key]: value } })

  // Solo or Dual: selecting one fills those times from the total and keeps them following it
  // (see applyPatch in draft.ts).
  const chooseType = (flightType: FlightType) => update({ flightType })

  // Tapping the selected option again turns Autofill off and clears the times it filled in.
  const clearType = () =>
    update({
      flightType: null,
      times:
        draft.flightType === 'solo'
          ? { ...t, soloTime: '0.0', picTime: '0.0' }
          : { ...t, dualReceivedTime: '0.0' },
    })

  const legSum = draftLegTotal(draft.legs)

  return (
    <>
      <section className={`card ${styles.panel} ${styles.totalCard}`}>
        <Stepper
          label="Total time"
          value={t.totalTime}
          onChange={(v) => setTime('totalTime', v)}
          error={errors.totalTime}
          labelClassName={styles.stepLabelText}
        />
        {/* Only shown once the total no longer matches the legs, to offer putting it back. */}
        {legSum > 0 &&
          !draft.totalFromLegs &&
          Number(t.totalTime) !== legSum && (
              <p className={styles.totalSource}>
                Your legs add up to <span className="mono">{legSum.toFixed(1)}</span>.{' '}
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => update({ times: { ...t, totalTime: legSum.toFixed(1) } })}
                >
                  Use leg total
                </button>
              </p>
          )}
      </section>

      <section className={`card ${styles.panel} ${styles.timesCard}`}>
        {/* Fills the rows below from the total (see applyPatch in draft.ts). */}
        <div className={`field ${styles.flightType}`}>
          <span>Autofill</span>
          <Segmented<FlightType>
            label="Flight type"
            value={draft.flightType}
            onChange={chooseType}
            onClear={clearType}
            options={[
              { value: 'solo', label: 'Solo' },
              { value: 'dual', label: 'Dual Received' },
            ]}
          />
        </div>
        {TIME_FIELDS.filter(([key]) => key !== 'totalTime').map(([key, label]) => (
          <Stepper key={key} label={label} value={t[key]} onChange={(v) => setTime(key, v)} error={errors[key]} />
        ))}
      </section>
    </>
  )
}
