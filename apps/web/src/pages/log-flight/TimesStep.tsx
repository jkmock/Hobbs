import { Segmented, Stepper } from '../../components/controls'
import { draftLegTotal, TIME_FIELDS, type FlightType, type PilotRole, type StepProps, type TimeField } from './draft'
import styles from './LogFlight.module.css'

export default function TimesStep({ draft, update, errors }: StepProps) {
  const t = draft.times
  const setTime = (key: TimeField, value: string) => update({ times: { ...t, [key]: value } })

  // The two Autofill rows: Solo / Dual Received, and PIC / SIC. Selecting an option fills its
  // time from the total and keeps it following it (see applyPatch in draft.ts); tapping it again
  // unselects it and clears that time. Unselecting an option also clears what it filled in.
  // Selecting one can unselect options in the other row:
  //   Solo selects PIC (a solo flight is PIC), and unselects SIC; unselecting Solo unselects PIC.
  //   Dual Received unselects PIC and SIC.
  //   PIC unselects Dual Received (but doesn't select Solo).
  //   SIC unselects Solo and Dual Received.
  const typeTime = { solo: 'soloTime', dual: 'dualReceivedTime' } as const
  const roleTime = { pic: 'picTime', sic: 'sicTime' } as const
  const select = (flightType: FlightType | null, pilotRole: PilotRole | null) => {
    const times = { ...t }
    if (draft.flightType && draft.flightType !== flightType) times[typeTime[draft.flightType]] = '0.0'
    if (draft.pilotRole && draft.pilotRole !== pilotRole) times[roleTime[draft.pilotRole]] = '0.0'
    update({ flightType, pilotRole, times })
  }
  const role = draft.pilotRole ?? null
  const chooseType = (type: FlightType) => select(type, type === 'solo' ? 'pic' : null)
  // Solo selected PIC, so unselecting Solo unselects PIC too.
  const clearType = () => select(null, draft.flightType === 'solo' && role === 'pic' ? null : role)
  const chooseRole = (r: PilotRole) =>
    select(r === 'sic' || draft.flightType === 'dual' ? null : draft.flightType, r)
  // Solo is PIC, so unselecting PIC unselects Solo too.
  const clearRole = () => select(role === 'pic' && draft.flightType === 'solo' ? null : draft.flightType, null)

  const legSum = draftLegTotal(draft.legs)
  const total = Number(t.totalTime) || 0

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
          <Segmented<PilotRole>
            label="Pilot role"
            value={role}
            onChange={chooseRole}
            onClear={clearRole}
            options={[
              { value: 'pic', label: 'PIC' },
              { value: 'sic', label: 'SIC' },
            ]}
          />
        </div>
        {TIME_FIELDS.filter(([key]) => key !== 'totalTime').map(([key, label]) => {
          // Tapping the label fills in the whole flight, or clears it if it already is.
          const isTotal = total > 0 && Number(t[key]) === total
          return (
            <Stepper
              key={key}
              label={label}
              value={t[key]}
              onChange={(v) => setTime(key, v)}
              error={errors[key]}
              onLabelClick={() => setTime(key, isTotal ? '0.0' : total.toFixed(1))}
              labelAction={isTotal ? `Set ${label} to 0` : `Set ${label} to total time`}
            />
          )
        })}
      </section>
    </>
  )
}
