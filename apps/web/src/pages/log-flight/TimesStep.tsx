import { Segmented, Stepper } from '../../components/controls'
import { TIME_FIELDS, useLegDistances, type StepProps, type TimeField } from './draft'
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
          ? { ...t, dualReceivedTime: t.totalTime, soloTime: '0.0' }
          : { ...t, soloTime: t.totalTime, picTime: t.totalTime, dualReceivedTime: '0.0' },
    })

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
        <div className="field">
          <span className="muted" style={{ fontSize: 13 }}>
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
