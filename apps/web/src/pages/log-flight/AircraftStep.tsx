import { useDeferredValue, useState, type FormEvent } from 'react'
import { Check, Plus, Search, X } from 'lucide-react'
import { CreateAircraftSchema } from '@hobbs/shared'
import { DateField, Segmented } from '../../components/controls'
import {
  useAddMyAircraft,
  useAircraftSearch,
  useCreateAircraft,
  useMyAircraft,
  useRemoveMyAircraft,
  useUpdateAircraft,
} from '../../hooks/useLookups'
import type { Aircraft } from '../../lib/types'
import { emptyLeg, type StepProps } from './draft'
import RecentFlights from './RecentFlights'
import styles from './LogFlight.module.css'

type Option = { id: string; tailNumber: string; detail?: string }

export default function AircraftStep({ draft, update, errors }: StepProps) {
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  // Edit mode swaps each row's Select for Edit and Remove; editingId is the row whose details are open.
  const [editModeOn, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const mine = useMyAircraft()
  const hasAircraft = (mine.data?.length ?? 0) > 0
  // With no aircraft left there's nothing to edit; adding one also ends edit mode.
  const editMode = editModeOn && hasAircraft
  const remove = useRemoveMyAircraft()
  const editingAircraft = mine.data?.find((a) => a.id === editingId)

  // Your aircraft (added or flown), narrowed by the search box, which matches the tail
  // number, make or model. Other people's aircraft are reached through "Add aircraft".
  const term = search.trim().toUpperCase()
  const matches = (o: Option) => `${o.tailNumber} ${o.detail ?? ''}`.toUpperCase().includes(term)
  let options: Option[] = (mine.data ?? []).map((a) => ({
    id: a.id,
    tailNumber: a.tailNumber,
    detail: `${a.make} ${a.model}`,
  }))
  // An aircraft that's selected but not on your list (a removed one, on a flight being edited)
  // is still shown, so it can be seen and changed.
  if (draft.aircraftId && !options.some((o) => o.id === draft.aircraftId)) {
    options = [{ id: draft.aircraftId, tailNumber: draft.tailNumber }, ...options]
  }
  options = options.filter(matches)

  // Legs imported from the selected aircraft's FlightAware flights belong to that aircraft,
  // so changing or clearing the aircraft drops them; hand-entered legs stay.
  const legsWithoutImported = () => {
    const kept = draft.legs.filter((leg) => !leg.faFlightId)
    return kept.length > 0 ? kept : [emptyLeg()]
  }

  const select = (a: { id: string; tailNumber: string }) => {
    if (a.id === draft.aircraftId) return
    update({ aircraftId: a.id, tailNumber: a.tailNumber, legs: legsWithoutImported() })
  }

  // Tapping the selected aircraft again clears it.
  const toggle = (a: { id: string; tailNumber: string }) => {
    if (a.id !== draft.aircraftId) return select(a)
    update({ aircraftId: '', tailNumber: '', legs: legsWithoutImported() })
  }

  // Removing the selected aircraft also clears the selection.
  const removeAircraft = (a: Option) =>
    remove.mutate(a.id, {
      onSuccess: () => {
        if (a.id === draft.aircraftId) toggle(a)
      },
    })

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
          <h2>{editingAircraft ? `Edit ${editingAircraft.tailNumber}` : 'My Aircraft'}</h2>
          {!adding && !editingAircraft && (
            <div className={styles.headActions}>
              {/* In edit mode, Done takes Add aircraft's place. */}
              {editMode ? (
                <button
                  type="button"
                  className={`btn btn--primary btn--sm ${styles.headButton}`}
                  onClick={() => {
                    setEditMode(false)
                    remove.reset()
                  }}
                >
                  Done
                </button>
              ) : (
                <>
                  {hasAircraft && (
                    <button type="button" className={styles.textButton} onClick={() => setEditMode(true)}>
                      Edit
                    </button>
                  )}
                  <button type="button" className={`btn btn--primary btn--sm ${styles.headButton}`} onClick={() => setAdding(true)}>
                    <Plus size={18} /> Add aircraft
                  </button>
                </>
              )}
            </div>
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
              setEditMode(false)
              setSearch('')
            }}
          />
        ) : editingAircraft ? (
          <AircraftDetails
            tailNumber={editingAircraft.tailNumber}
            aircraft={editingAircraft}
            onCancel={() => setEditingId(null)}
            onSaved={() => setEditingId(null)}
          />
        ) : (
          <>
            {/* Nothing to search until you have aircraft; "Add aircraft" is the way in. */}
            {hasAircraft && (
              <label style={{ position: 'relative' }}>
                <Search size={17} aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
                <input
                  className={`input ${styles.airportInput}`}
                  style={{ paddingLeft: 38, paddingRight: 38 }}
                  placeholder="Search your aircraft"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search your aircraft"
                />
                {search && (
                  <button type="button" className={styles.clearSearch} onClick={() => setSearch('')} aria-label="Clear search">
                    <X size={17} aria-hidden />
                  </button>
                )}
              </label>
            )}

            {options.length > 0 && (
              <ul className={styles.optionList}>
                {options.map((option) => {
                  const isSelected = option.id === draft.aircraftId
                  return (
                    <li key={option.id} className={styles.option}>
                      <span className={styles.tail}>{option.tailNumber}</span>
                      <span className={styles.detail}>{option.detail}</span>
                      {editMode ? (
                        <div className={styles.rowActions}>
                          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditingId(option.id)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`btn btn--sm btn--danger ${styles.removeButton}`}
                            disabled={remove.isPending}
                            onClick={() => removeAircraft(option)}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
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
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {editMode && remove.error && <p className="error-text">{remove.error.message}</p>}
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
          {/* Labelled like the Tail number field above it. */}
          <div className="field">
            <span>Aircraft found</span>
            <div className={styles.found}>
              <span className={styles.tail}>{existing.tailNumber}</span>
              <span className={styles.detail}>
                {existing.make} {existing.model}
                {existing.year ? `, ${existing.year}` : ''}
              </span>
            </div>
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
                Add to My Aircraft
              </button>
            )}
          </div>
        </>
      ) : (
        <AircraftDetails tailNumber={deferredTail} onCancel={onCancel} onSaved={onAdded} />
      )}

      {isComplete && !existing && !checking && lookup.isError && (
        <p className="error-text">{lookup.error.message}</p>
      )}
    </div>
  )
}

const TAIL_NUMBER = /^[A-Z0-9-]{2,10}$/

type AircraftClass = 'single_engine_land' | 'multi_engine_land'

// Details for a tail number Hobbs doesn't have yet, or, given `aircraft`, edits that aircraft's details.
function AircraftDetails({
  tailNumber,
  aircraft,
  onCancel,
  onSaved,
}: {
  tailNumber: string
  aircraft?: Aircraft
  onCancel: () => void
  onSaved: (aircraft: Aircraft) => void
}) {
  const createAircraft = useCreateAircraft()
  const updateAircraft = useUpdateAircraft()
  const save = aircraft ? updateAircraft : createAircraft
  const [form, setForm] = useState({
    make: aircraft?.make ?? '',
    model: aircraft?.model ?? '',
    year: aircraft?.year ? String(aircraft.year) : '',
    aircraftClass: aircraft?.aircraftClass ?? ('single_engine_land' as AircraftClass),
    isTailwheel: aircraft?.isTailwheel ?? false,
    isComplex: aircraft?.isComplex ?? false,
    isHighPerf: aircraft?.isHighPerf ?? false,
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
    if (aircraft) {
      const { tailNumber: _tail, ...details } = parsed.data
      updateAircraft.mutate({ id: aircraft.id, ...details }, { onSuccess: onSaved })
    } else {
      createAircraft.mutate(parsed.data, { onSuccess: onSaved })
    }
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

      {save.error && <p className="error-text">{save.error.message}</p>}

      <div className={styles.twoCol}>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn--primary" disabled={save.isPending}>
          {aircraft ? 'Save' : 'Add aircraft'}
        </button>
      </div>
    </form>
  )
}
