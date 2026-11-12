import { useState } from 'react'
import { DateField } from '../../components/controls'
import MyAircraft from '../../components/MyAircraft'
import { emptyLeg, type StepProps } from './draft'
import RecentFlights from './RecentFlights'
import styles from './LogFlight.module.css'

export default function AircraftStep({ draft, update, errors, clearError }: StepProps) {
  const [adding, setAdding] = useState(false)

  // Legs imported from the selected aircraft's FlightAware flights belong to that aircraft,
  // so changing or clearing the aircraft drops them; hand-entered legs stay.
  const legsWithoutImported = () => {
    const kept = draft.legs.filter((leg) => !leg.faFlightId)
    return kept.length > 0 ? kept : [emptyLeg()]
  }

  // Choosing an aircraft (Select, or adding one) answers "Choose an aircraft".
  const select = (a: { id: string; tailNumber: string }) => {
    clearError('aircraftId')
    if (a.id === draft.aircraftId) return
    update({ aircraftId: a.id, tailNumber: a.tailNumber, legs: legsWithoutImported() })
  }

  return (
    <>
      <section className={`card ${styles.panel} ${styles.totalCard}`}>
        <DateField
          label="Flight Date"
          value={draft.flightDate}
          onChange={(flightDate) => update({ flightDate })}
          error={errors.flightDate}
          labelClassName={styles.dateLabel}
          buttonClassName={styles.headButton}
        />
      </section>

      <MyAircraft
        selected={draft.aircraftId ? { id: draft.aircraftId, tailNumber: draft.tailNumber } : null}
        onSelect={select}
        onDeselect={() => update({ aircraftId: '', tailNumber: '', legs: legsWithoutImported() })}
        error={errors.aircraftId}
        onAddingChange={setAdding}
      />

      {draft.aircraftId && !adding && <RecentFlights draft={draft} update={update} />}
    </>
  )
}
