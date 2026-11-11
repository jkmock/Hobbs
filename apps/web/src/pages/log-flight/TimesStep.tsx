import { Segmented, Stepper } from '../../components/controls'
import { draftLegTotal, TIME_FIELDS, useLegDistances, type StepProps, type TimeField } from './draft'
import styles from './LogFlight.module.css'

type FlightType = 'dual' | 'solo'

export default function TimesStep({ draft, update, errors }: StepProps) {
  const { distances } = useLegDistances(draft.legs)
  const t = draft.times
  const setTime = (key: TimeField, value: string) => update({ times: { ...t, [key]: value } })

  const dual = Number(t.dualReceivedTime) > 0
  const solo = Number(t.soloTime) > 0
  const flightType: FlightType | null = dual && !solo ? 'dual' : solo && !dual ? 'solo' : null

  // Shortcut: most training flights are all dual or all solo.
  const chooseType = (type: FlightType) =>
    update({
      times:
        type === 'dual'
          ? {
              ...t,
              dualReceivedTime: t.totalTime,
              soloTime: '0.0',
              // Dual never adds PIC. It only takes back PIC the Solo shortcut filled in
              // (PIC equal to solo); PIC entered by hand is left alone.
              picTime: t.picTime === t.soloTime ? '0.0' : t.picTime,
            }
          : { ...t, soloTime: t.totalTime, picTime: t.totalTime, dualReceivedTime: '0.0' },
    })

  const legSum = draftLegTotal(draft.legs)
  const legsWithTime = draft.legs.filter((l) => Number(l.time) > 0).length

  const isCrossCountryRoute = distances.some((nm) => nm != null && nm > 50)
  const suggestCrossCountry = isCrossCountryRoute && Number(t.crossCountryTime) === 0 && Number(t.totalTime) > 0

  return (
    <>
      <section className={`card ${styles.panel}`}>
        <Stepper
          label="Total time"
          value={t.totalTime}
          onChange={(v) => setTime('totalTime', v)}
          error={errors.totalTime}
        />
        {legSum > 0 &&
          (draft.totalFromLegs ? (
            <p className={styles.totalSource}>
              Sum of {legsWithTime === 1 ? 'your leg' : `your ${legsWithTime} legs`}. Change it if your Hobbs time differs.
            </p>
          ) : (
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
            )
          ))}
        <div className="field">
          <span className="muted" style={{ fontSize: 14.5 }}>
            Fill from total
          </span>
          <Segmented<FlightType>
            label="Flight type"
            value={flightType}
            onChange={chooseType}
            options={[
              { value: 'dual', label: 'Dual' },
              { value: 'solo', label: 'Solo' },
            ]}
          />
        </div>
      </section>

      <section className={`card ${styles.panel}`} style={{ gap: 0 }}>
        {TIME_FIELDS.filter(([key]) => key !== 'totalTime').map(([key, label]) => (
          <Stepper key={key} label={label} value={t[key]} onChange={(v) => setTime(key, v)} error={errors[key]} />
        ))}
      </section>

      {suggestCrossCountry && (
        <div className={`notice ${styles.hint}`}>
          <span>This route has a leg over 50 nm.</span>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setTime('crossCountryTime', t.totalTime)}
          >
            Log as cross-country
          </button>
        </div>
      )}
    </>
  )
}
