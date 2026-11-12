import { useEffect, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Trash2, X } from 'lucide-react'
import { CreateFlightSchema } from '@hobbs/shared'
import { useDeleteFlight, useFlight, useSaveFlight } from '../../hooks/useFlights'
import {
  applyPatch,
  draftFromFlight,
  emptyDraft,
  friendlyMessage,
  STEPS,
  syncCrossCountry,
  toInput,
  useLegDistances,
  type Draft,
} from './draft'
import AircraftStep from './AircraftStep'
import RouteStep from './RouteStep'
import TimesStep from './TimesStep'
import LandingsStep from './LandingsStep'
import styles from './LogFlight.module.css'

// /flights/new and /flights/:id/edit. Editing waits for the flight to load,
// then starts the wizard with it, so the wizard never has to "sync" from props.
export default function LogFlightPage() {
  const { id } = useParams()
  const flight = useFlight(id)

  if (!id) return <FlightWizard key="new" initial={emptyDraft()} />
  if (flight.isPending) return <p className="page muted">Loading flight…</p>
  if (flight.isError) return <p className="page error-text">{flight.error.message}</p>
  return <FlightWizard key={id} id={id} initial={draftFromFlight(flight.data)} />
}

const STEP_COMPONENTS = [AircraftStep, RouteStep, TimesStep, LandingsStep]

function FlightWizard({ id, initial }: { id?: string; initial: Draft }) {
  const navigate = useNavigate()
  const save = useSaveFlight(id)
  const deleteFlight = useDeleteFlight()
  const [draft, setDraft] = useState(initial)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const update = (patch: Partial<Draft>) => setDraft((d) => applyPatch(d, patch))
  const clearError = (key: string) =>
    setErrors((e) => {
      if (!(key in e)) return e
      const { [key]: _, ...rest } = e
      return rest
    })

  // Any change to the total time, however it's made (the stepper, typing, "Use leg total",
  // or the leg times), clears its error. Compared during render, React's pattern for
  // reacting to a changed value without an effect.
  const [seenTotal, setSeenTotal] = useState(draft.times.totalTime)
  if (draft.times.totalTime !== seenTotal) {
    setSeenTotal(draft.times.totalTime)
    clearError('totalTime')
  }

  // Cross-country time is the total time when the route qualifies (see crossCountryTime).
  // Distances need the airports, which load separately, so this runs after each change
  // rather than inside applyPatch.
  const { fromStart, pending } = useLegDistances(draft.legs)
  useEffect(() => {
    setDraft((d) => syncCrossCountry(d, fromStart, pending))
  }, [draft, fromStart.join(), pending])

  const isLast = step === STEPS.length - 1

  // Validates the whole flight, keeps only errors from the given steps,
  // and returns the parsed body when there are none.
  function check(stepIndexes: number[]) {
    const result = CreateFlightSchema.safeParse(toInput(draft))
    if (result.success) {
      setErrors({})
      return { data: result.data, firstBadStep: null }
    }

    const found: Record<string, string> = {}
    let firstBadStep: number | null = null
    for (const issue of result.error.issues) {
      const owner = STEPS.findIndex((s) => (s.fields as readonly PropertyKey[]).includes(issue.path[0]!))
      if (!stepIndexes.includes(owner)) continue
      const key = issue.path.join('.')
      found[key] ??= friendlyMessage(issue)
      if (firstBadStep === null || owner < firstBadStep) firstBadStep = owner
    }
    setErrors(found)
    return { data: firstBadStep === null ? result.data : null, firstBadStep }
  }

  function next() {
    const { firstBadStep } = check([step])
    if (firstBadStep === null) setStep(step + 1)
  }

  function submit() {
    const { data, firstBadStep } = check(STEPS.map((_, i) => i))
    if (firstBadStep !== null) return setStep(firstBadStep)
    if (data) save.mutate(data, { onSuccess: () => navigate('/flights') })
  }

  function remove() {
    if (!id || !window.confirm('Delete this flight from your logbook?')) return
    deleteFlight.mutate(id, { onSuccess: () => navigate('/flights') })
  }

  const Step = STEP_COMPONENTS[step]!

  // Moving between a step's fields from the keyboard:
  // - Enter goes to the next field, like Tab. From the last field it just leaves the field
  //   (which also closes a phone's keyboard); it never changes the step or saves the flight.
  // - Backspace in an empty field goes back to the previous field, cursor at the end, so
  //   holding or repeating it keeps deleting back through the fields.
  // Fields that handle Enter themselves (a form, the notes box, the new-instructor field)
  // are left alone.
  function keyboardNav(e: KeyboardEvent<HTMLDivElement>) {
    if (e.defaultPrevented || e.nativeEvent.isComposing) return
    if (e.key !== 'Enter' && e.key !== 'Backspace') return
    const field = e.target as HTMLElement
    if (!isTextField(field) || field.closest('form')) return
    const fields = [...e.currentTarget.querySelectorAll<HTMLElement>('input, select')].filter(isTextField)
    const at = fields.indexOf(field)

    if (e.key === 'Enter') {
      e.preventDefault()
      const following = fields[at + 1]
      if (following) following.focus()
      else field.blur()
      return
    }

    // Backspace: only from an empty text box, and only if there's a field before it.
    const previous = fields[at - 1]
    if (!(field instanceof HTMLInputElement) || field.value !== '' || !previous) return
    e.preventDefault()
    previous.focus()
    if (previous instanceof HTMLInputElement) {
      const end = previous.value.length
      try {
        previous.setSelectionRange(end, end)
      } catch {
        // some input types (number, date) don't have a cursor to place
      }
    }
  }

  return (
    <div className={styles.wizard}>
      <header className={styles.header}>
        <h1>{id ? 'Edit flight' : 'Log flight'}</h1>
        <div className={styles.headerActions}>
          {id && (
            <button type="button" className="icon-btn" aria-label="Delete flight" onClick={remove}>
              <Trash2 size={20} />
            </button>
          )}
          <Link to="/flights" className="icon-btn" aria-label="Close">
            <X size={24} />
          </Link>
        </div>
      </header>

      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={i === step ? 'step' : undefined}
              data-done={i < step || undefined}
            >
              {s.title}
            </button>
          </li>
        ))}
      </ol>

      <div className={styles.body} onKeyDown={keyboardNav}>
        <Step draft={draft} update={update} errors={errors} clearError={clearError} />
      </div>

      <footer className={styles.footer}>
        {(save.error || deleteFlight.error) && (
          <p className="error-text">{(save.error ?? deleteFlight.error)?.message}</p>
        )}
        <div className={styles.footerButtons}>
          {step > 0 && (
            <button type="button" className={`card ${styles.backButton}`} onClick={() => setStep(step - 1)} aria-label="Back">
              <ArrowLeft size={18} />
            </button>
          )}
          {isLast ? (
            <button
              type="button"
              className={`card ${styles.nextButton}`}
              onClick={submit}
              disabled={save.isPending}
            >
              {save.isPending ? 'Saving…' : id ? 'Save changes' : 'Log Flight'}
            </button>
          ) : (
            <button type="button" className={`card ${styles.nextButton}`} onClick={next}>
              Next
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}

// A field you type into or pick from, that Enter should move on from (not a checkbox or button).
function isTextField(el: Element): el is HTMLInputElement | HTMLSelectElement {
  if (el instanceof HTMLSelectElement) return !el.disabled
  if (!(el instanceof HTMLInputElement) || el.disabled || el.readOnly) return false
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'hidden', 'file', 'range', 'color'].includes(el.type)
}
