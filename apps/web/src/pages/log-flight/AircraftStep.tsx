import { useDeferredValue, useState, type FormEvent } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { CreateAircraftSchema } from '@hobbs/shared'
import { DateField, Segmented } from '../../components/controls'
import {
  useAddMyAircraft,
  useAircraftSearch,
  useCreateAircraft,
  useMyAircraft,
} from '../../hooks/useLookups'
import type { Aircraft } from '../../lib/types'
import { emptyLeg, type StepProps } from './draft'
import RecentFlights from './RecentFlights'
import styles from './LogFlight.module.css'

type Option = { id: string; tailNumber: string; detail?: string }

export default function AircraftStep({ draft, update, errors }: StepProps) {
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const mine = useMyAircraft()

  // Your aircraft (added or flown), narrowed by the search box. Other people's aircraft
  // are reached through "Add aircraft".
  const term = search.trim().toUpperCase()
  let options: Option[] = (mine.data ?? [])
    .filter((a) => a.tailNumber.includes(term))
    .map((a) => ({ id: a.id, tailNumber: a.tailNumber, detail: `${a.make} ${a.model}` }))
  if (draft.aircraftId && !options.some((o) => o.id === draft.aircraftId)) {
    options = [{ id: draft.aircraftId, tailNumber: draft.tailNumber }, ...options]
  }

  const select = (a: { id: string; tailNumber: string }) => update({ aircraftId: a.id, tailNumber: a.tailNumber })

  // Tapping the selected aircraft again clears it. Legs imported from its FlightAware
  // flights go too, since they belong to that aircraft; hand-entered legs stay.
  const toggle = (a: { id: string; tailNumber: string }) => {
    if (a.id !== draft.aircraftId) return select(a)
    const kept = draft.legs.filter((leg) => !leg.faFlightId)
    update({ aircraftId: '', tailNumber: '', legs: kept.length > 0 ? kept : [emptyLeg()] })
  }

  return (
    <>
      <section className={`card ${styles.panel} ${styles.totalCard}`}>
        <DateField
          label="Date"
          value={draft.flightDate}
          onChange={(flightDate) => update({ flightDate })}
          error={errors.flightDate}
          labelClassName={styles.dateLabel}
          buttonClassName={styles.headButton}
        />
      </section>

      <section className={`card ${styles.panel}`}>
        <div className={styles.panelHead}>
          <h2>My Aircraft</h2>
          {!adding && (
            <button type="button" className={`btn btn--primary btn--sm ${styles.headButton}`} onClick={() => setAdding(true)}>
              <Plus size={18} /> Add aircraft
            </button>
          )}
        </div>

        {adding ? (
          <AddAircraft
            initialTail={search}
            mine={mine.data ?? []}
            onCancel={() => setAdding(false)}
            onAdded={(a) => {
              select(a)
              setAdding(false)
              setSearch('')
            }}
          />
        ) : (
          <>
            <label style={{ position: 'relative' }}>
              <Search size={17} aria-hidden style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ink-3)' }} />
              <input
                className={`input ${styles.airportInput}`}
                style={{ paddingLeft: 38 }}
                placeholder="Search your aircraft"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search your aircraft"
              />
            </label>

            {mine.isSuccess && mine.data.length === 0 && (
              <p className="muted" style={{ fontSize: 14 }}>
                No aircraft yet. Add the one you're flying with "Add aircraft".
              </p>
            )}

            <ul className={styles.optionList}>
              {options.map((option) => {
                const isSelected = option.id === draft.aircraftId
                return (
                  <li key={option.id} className={styles.option}>
                    <span className={styles.tail}>{option.tailNumber}</span>
                    <span className={styles.detail}>{option.detail}</span>
                    <button
                      type="button"
                      className={`btn btn--sm ${styles.selectButton} ${isSelected ? styles.selected : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => toggle(option)}
                    >
                      {isSelected ? (
                        <>
                          <Check size={14} /> Selected
                        </>
                      ) : (
                        'Select'
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {errors.aircraftId && <p className="error-text">{errors.aircraftId}</p>}
      </section>

      {draft.aircraftId && !adding && <RecentFlights draft={draft} update={update} />}
    </>
  )
}

// "Add aircraft": enter the tail number first. If Hobbs already has it (someone else added it),
// offer to add it to your aircraft; otherwise ask for its details and create it.
function AddAircraft({
  initialTail,
  mine,
  onCancel,
  onAdded,
}: {
  initialTail: string
  mine: Aircraft[]
  onCancel: () => void
  onAdded: (aircraft: Aircraft) => void
}) {
  const [tail, setTail] = useState(initialTail.trim().toUpperCase())
  const deferredTail = useDeferredValue(tail.trim())
  const lookup = useAircraftSearch(deferredTail)
  const addMine = useAddMyAircraft()

  const isComplete = TAIL_NUMBER.test(deferredTail)
  const existing = lookup.data?.find((a) => a.tailNumber === deferredTail)
  const alreadyMine = existing && mine.some((a) => a.id === existing.id)
  const checking = tail.trim() !== deferredTail || lookup.isFetching

  return (
    <div className="stack">
      <label className="field">
        <span>Tail number</span>
        <input
          className={`input ${styles.airportInput}`}
          value={tail}
          autoFocus
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setTail(e.target.value.toUpperCase())}
          placeholder="N123AB"
        />
      </label>

      {!isComplete || (checking && !existing) ? (
        // Nothing to show until the tail number is typed and looked up; Cancel is always available.
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      ) : existing ? (
        <>
          <div className={styles.found}>
            <span className={styles.tail}>{existing.tailNumber}</span>
            <span className={styles.detail}>
              {existing.make} {existing.model}
              {existing.year ? `, ${existing.year}` : ''}
            </span>
          </div>
          {addMine.error && <p className="error-text">{addMine.error.message}</p>}
          <div className={styles.twoCol}>
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
            {alreadyMine ? (
              <button type="button" className="btn btn--primary" onClick={() => onAdded(existing)}>
                Already yours, select it
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                disabled={addMine.isPending}
                onClick={() => addMine.mutate(existing.id, { onSuccess: onAdded })}
              >
                Add to my aircraft
              </button>
            )}
          </div>
        </>
      ) : (
        <NewAircraftDetails tailNumber={deferredTail} onCancel={onCancel} onCreated={onAdded} />
      )}

      {isComplete && !existing && !checking && lookup.isError && (
        <p className="error-text">{lookup.error.message}</p>
      )}
    </div>
  )
}

const TAIL_NUMBER = /^[A-Z0-9-]{2,10}$/

type AircraftClass = 'single_engine_land' | 'multi_engine_land'

// Details for a tail number Hobbs doesn't have yet.
function NewAircraftDetails({
  tailNumber,
  onCancel,
  onCreated,
}: {
  tailNumber: string
  onCancel: () => void
  onCreated: (aircraft: Aircraft) => void
}) {
  const create = useCreateAircraft()
  const [form, setForm] = useState({
    make: '',
    model: '',
    year: '',
    aircraftClass: 'single_engine_land' as AircraftClass,
    isTailwheel: false,
    isComplex: false,
    isHighPerf: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = CreateAircraftSchema.safeParse({
      ...form,
      tailNumber,
      year: form.year ? Number(form.year) : undefined,
    })
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])))
      return
    }
    setErrors({})
    create.mutate(parsed.data, { onSuccess: onCreated })
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className={styles.twoCol}>
        <label className="field">
          <span>Make</span>
          <input className="input" value={form.make} onChange={(e) => set({ make: e.target.value })} placeholder="Cessna" />
          {errors.make && <span className="error-text">Required</span>}
        </label>
        <label className="field">
          <span>Model</span>
          <input className="input" value={form.model} onChange={(e) => set({ model: e.target.value })} placeholder="172N" />
          {errors.model && <span className="error-text">Required</span>}
        </label>
        <label className="field">
          <span>Year</span>
          <input
            className="input"
            inputMode="numeric"
            value={form.year}
            onChange={(e) => set({ year: e.target.value })}
            placeholder="1978"
          />
          {errors.year && <span className="error-text">{errors.year}</span>}
        </label>
      </div>
      {errors.tailNumber && <p className="error-text">{errors.tailNumber}</p>}

      <Segmented<AircraftClass>
        label="Class"
        value={form.aircraftClass}
        onChange={(aircraftClass) => set({ aircraftClass })}
        options={[
          { value: 'single_engine_land', label: 'Single-engine' },
          { value: 'multi_engine_land', label: 'Multi-engine' },
        ]}
      />

      <div className={styles.checks}>
        <label>
          <input type="checkbox" checked={form.isTailwheel} onChange={(e) => set({ isTailwheel: e.target.checked })} />
          Tailwheel
        </label>
        <label>
          <input type="checkbox" checked={form.isComplex} onChange={(e) => set({ isComplex: e.target.checked })} />
          Complex
        </label>
        <label>
          <input type="checkbox" checked={form.isHighPerf} onChange={(e) => set({ isHighPerf: e.target.checked })} />
          High performance
        </label>
      </div>

      {create.error && <p className="error-text">{create.error.message}</p>}

      <div className={styles.twoCol}>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn--primary" disabled={create.isPending}>
          Add aircraft
        </button>
      </div>
    </form>
  )
}
