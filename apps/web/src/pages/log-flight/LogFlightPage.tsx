import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Trash2, X } from 'lucide-react'
import { CreateFlightSchema } from '@hobbs/shared'
import { useDeleteFlight, useFlight, useSaveFlight } from '../../hooks/useFlights'
import { draftFromFlight, emptyDraft, friendlyMessage, STEPS, toInput, type Draft } from './draft'
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

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
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

      <div className={styles.body}>
        <Step draft={draft} update={update} errors={errors} />
      </div>

      <footer className={styles.footer}>
        {(save.error || deleteFlight.error) && (
          <p className="error-text">{(save.error ?? deleteFlight.error)?.message}</p>
        )}
        <div className={styles.footerButtons}>
          {step > 0 && (
            <button type="button" className="btn btn--lg" onClick={() => setStep(step - 1)} aria-label="Back">
              <ArrowLeft size={18} />
            </button>
          )}
          {isLast ? (
            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              onClick={submit}
              disabled={save.isPending}
            >
              {save.isPending ? 'Saving…' : id ? 'Save changes' : 'Log flight'}
            </button>
          ) : (
            <button type="button" className="btn btn--primary btn--lg btn--block" onClick={next}>
              Next: {STEPS[step + 1]!.title}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
