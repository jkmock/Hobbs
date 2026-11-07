import { useDeferredValue, useState, type FormEvent } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { CreateAircraftSchema } from '@hobbs/shared'
import { Segmented } from '../../components/controls'
import { useAllFlights } from '../../hooks/useFlights'
import { useAircraftSearch, useCreateAircraft, useCreateInstructor, useInstructors } from '../../hooks/useLookups'
import type { Aircraft } from '../../lib/types'
import type { StepProps } from './draft'
import styles from './LogFlight.module.css'

type Option = { id: string; tailNumber: string; detail?: string }

export default function AircraftStep({ draft, update, errors }: StepProps) {
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const deferredSearch = useDeferredValue(search) // don't fire a request on every keystroke mid-render
  const results = useAircraftSearch(deferredSearch)
  const { data: flights = [] } = useAllFlights()

  // With no search, offer the aircraft from your own logbook.
  const recent = new Map<string, Option>()
  for (const f of flights) {
    if (!recent.has(f.aircraftId)) recent.set(f.aircraftId, { id: f.aircraftId, tailNumber: f.tailNumber })
  }

  let options: Option[] = search.trim()
    ? (results.data ?? []).map((a) => ({ id: a.id, tailNumber: a.tailNumber, detail: `${a.make} ${a.model}` }))
    : [...recent.values()].slice(0, 5)
  if (draft.aircraftId && !options.some((o) => o.id === draft.aircraftId)) {
    options = [{ id: draft.aircraftId, tailNumber: draft.tailNumber }, ...options]
  }

  const select = (a: { id: string; tailNumber: string }) => update({ aircraftId: a.id, tailNumber: a.tailNumber })

  return (
    <>
      <section className={`card ${styles.panel}`}>
        <div className={styles.panelHead}>
          <h2>Aircraft</h2>
          {!adding && (
            <button type="button" className="btn btn--sm" onClick={() => setAdding(true)}>
              <Plus size={15} /> Add new
            </button>
          )}
        </div>

        {adding ? (
          <NewAircraftForm
            initialTail={search}
            onCancel={() => setAdding(false)}
            onCreated={(a) => {
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
                placeholder="Search tail number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search tail number"
              />
            </label>

            {!search.trim() && options.length > 0 && <p className="muted" style={{ fontSize: 13 }}>Recently flown</p>}

            <ul className={styles.optionList}>
              {options.map((option) => {
                const isSelected = option.id === draft.aircraftId
                return (
                  <li key={option.id} className={styles.option}>
                    <span className={styles.tail}>{option.tailNumber}</span>
                    <span className={styles.detail}>{option.detail}</span>
                    <button
                      type="button"
                      className={`btn btn--sm ${isSelected ? styles.selected : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => select(option)}
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

            {search.trim() && results.isSuccess && results.data.length === 0 && (
              <p className="muted" style={{ fontSize: 14 }}>
                No aircraft starting with <span className="mono">{search.trim().toUpperCase()}</span>.{' '}
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(true)}>
                  Add it
                </button>
              </p>
            )}
          </>
        )}
        {errors.aircraftId && <p className="error-text">{errors.aircraftId}</p>}
      </section>

      <section className={`card ${styles.panel}`}>
        <div className={styles.panelHead}>
          <h2>Flight</h2>
        </div>
        <div className={styles.twoCol}>
          <label className="field">
            <span>Date</span>
            <input
              className="input"
              type="date"
              value={draft.flightDate}
              onChange={(e) => update({ flightDate: e.target.value })}
            />
            {errors.flightDate && <span className="error-text">{errors.flightDate}</span>}
          </label>
          <InstructorPicker value={draft.instructorId} onChange={(instructorId) => update({ instructorId })} />
        </div>
      </section>
    </>
  )
}

function InstructorPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: instructors = [] } = useInstructors()
  const create = useCreateInstructor()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const save = () => {
    const [first, ...rest] = name.trim().split(/\s+/)
    if (!first || rest.length === 0) return
    create.mutate(
      { firstName: first, lastName: rest.join(' ') },
      {
        onSuccess: (instructor) => {
          onChange(instructor.id)
          setAdding(false)
          setName('')
        },
      },
    )
  }

  if (adding) {
    return (
      <label className="field">
        <span>New instructor</span>
        <input
          className="input"
          placeholder="First and last name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          onBlur={() => !name.trim() && setAdding(false)}
        />
        {create.error && <span className="error-text">{create.error.message}</span>}
      </label>
    )
  }

  return (
    <label className="field">
      <span>
        Instructor <span style={{ fontWeight: 400 }}>(optional)</span>
      </span>
      <select
        className="input"
        value={value}
        onChange={(e) => (e.target.value === '__new' ? setAdding(true) : onChange(e.target.value))}
      >
        <option value="">None</option>
        {instructors.map((i) => (
          <option key={i.id} value={i.id}>
            {i.firstName} {i.lastName}
          </option>
        ))}
        <option value="__new">Add instructor…</option>
      </select>
    </label>
  )
}

type AircraftClass = 'single_engine_land' | 'multi_engine_land'

function NewAircraftForm({
  initialTail,
  onCancel,
  onCreated,
}: {
  initialTail: string
  onCancel: () => void
  onCreated: (aircraft: Aircraft) => void
}) {
  const create = useCreateAircraft()
  const [form, setForm] = useState({
    tailNumber: initialTail.trim().toUpperCase(),
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
    const parsed = CreateAircraftSchema.safeParse({ ...form, year: form.year ? Number(form.year) : undefined })
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
          <span>Tail number</span>
          <input
            className={`input ${styles.airportInput}`}
            value={form.tailNumber}
            onChange={(e) => set({ tailNumber: e.target.value })}
            placeholder="N123AB"
          />
          {errors.tailNumber && <span className="error-text">{errors.tailNumber}</span>}
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
      </div>

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
