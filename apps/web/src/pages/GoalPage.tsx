import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Award, Check } from 'lucide-react'
import type { AtpRequiredHours, CheckrideGoalId, GoalId } from '@hobbs/shared'
import PageHeader from '../components/PageHeader'
import ProgressBar from '../components/ProgressBar'
import PageLoading from '../components/PageLoading'
import ConfirmDialog from '../components/ConfirmDialog'
import barStyles from '../components/ProgressBar.module.css'
import { Segmented, Select, Stepper } from '../components/controls'
import { useAllFlights } from '../hooks/useFlights'
import { useMyAircraft } from '../hooks/useLookups'
import { useGoal, useLogCheckride, useRemoveCheckride, useSaveGoal, type GoalSettings } from '../hooks/useGoal'
import { adjusted, goalById, GOALS, type GoalProgress, type Requirement } from '../lib/progress'
import { formatDate } from '../lib/format'
import { POP_MS, POP_SCALE } from '../lib/press'
import type { Aircraft, Checkride, Flight } from '../lib/types'
import listStyles from '../components/FlightList.module.css'
import styles from './GoalPage.module.css'

const DEFAULT_SETTINGS: GoalSettings = { goal: null, adjustments: {}, atpRequiredHours: 1500, checkrides: [] }

// The ATP goal's Required hours: 1500, or less for a restricted ATP (14 CFR 61.160).
const ATP_HOURS_OPTIONS: { value: AtpRequiredHours; label: string }[] = [
  { value: 1500, label: '1500 (Default)' },
  { value: 1250, label: '1250 (Aviation Associates Degree)' },
  { value: 1000, label: '1000 (Aviation Bachelors Degree)' },
  { value: 750, label: '750 (Military Pilot)' },
]

// Progress toward the certificate or rating you're working on, worked out from your flights
// plus any adjustments you've made (Update: time logged before Hobbs, or a different goal), and
// the checkride at the end of it.
export default function GoalPage() {
  const { data: flights = [], isPending } = useAllFlights()
  const { data: myAircraft = [] } = useMyAircraft()
  const goalSettings = useGoal()
  const [editing, setEditing] = useState(false)

  const settings = goalSettings.data ?? DEFAULT_SETTINGS
  const goal = goalById(settings.goal ?? 'none')
  const aircraft = useMemo(() => new Map(myAircraft.map((a) => [a.id, a])), [myAircraft])
  const { total, sections } = adjusted(goal.progress(flights, aircraft, { atpRequiredHours: settings.atpRequiredHours }), settings.adjustments)
  const loading = isPending || goalSettings.isPending
  const known = goalSettings.data?.goal != null // the goal, loaded and set

  // A new account has no goal yet: Set Your Goal, in place of the page.
  if (!loading && goalSettings.data && settings.goal === null) {
    return <GoalEditor setup settings={settings} flights={flights} aircraft={aircraft} onDone={() => setEditing(false)} />
  }
  if (editing && !loading) {
    return <GoalEditor settings={settings} flights={flights} aircraft={aircraft} onDone={() => setEditing(false)} />
  }

  return (
    <>
      <PageHeader
        // Blank (a non-breaking space, so the header keeps its height) until the goal has loaded.
        title={known ? goal.title : '\u00a0'}
        subtitle={known ? goal.subtitle : '\u00a0'}
        className={listStyles.topHeader}
        action={
          !loading && (
            <button type="button" className={`btn btn--primary`} onClick={() => setEditing(true)}>
              Update
            </button>
          )
        }
      />
      <div className="page">
        {loading ? (
          <PageLoading />
        ) : (
          <>
            {goalSettings.isError && <p className="error-text">{goalSettings.error.message}</p>}
            <div className={`card ${styles.card}`}>
              <ProgressBar requirement={total} large />
            </div>

            {/* Styled like Profile's Stats card: a floating card with its heading inside, and a
                row per requirement. */}
            {sections.map((section) => (
              <section key={section.title} className={`card ${styles.card}`}>
                <h2>{section.title}</h2>
                <div className={styles.list}>
                  {section.items.map((item) => (
                    <ProgressBar key={item.key} requirement={item} />
                  ))}
                </div>
              </section>
            ))}

            {/* No Specific Goal has no checkride. */}
            {goal.id !== 'none' && (
              <CheckrideCard
                goalId={goal.id}
                passed={settings.checkrides.find((c) => c.goal === goal.id)}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}

// The checkride: the plan's name and Log checkride. Log checkride opens the card where it is:
// it grows to show a ribbon, the congratulations, Public or Private, and Log Checkride /
// Cancel, and the page scrolls down with it so it stays in view; then it pops. Cancel runs it
// back. Once logged, the card says when it was passed.
const EXPAND_MS = 340
const EXPAND_EASING = 'cubic-bezier(0.33, 1, 0.68, 1)' // the same curve as easeOut below
const easeOut = (t: number) => 1 - (1 - t) ** 3
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// The rating a goal earns, for the congratulations: "Private Pilot rating", "Instrument rating".
const ratingName = (title: string) => `${title.replace(/ Rating$/, '')} rating`

// Scrolls `el` by `by` px over EXPAND_MS, in step with the card's growing (or shrinking).
function scrollAlong(el: HTMLElement, by: number) {
  if (by === 0) return
  const start = el.scrollTop
  if (reducedMotion()) return void (el.scrollTop = start + by)
  const t0 = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / EXPAND_MS)
    el.scrollTop = start + by * easeOut(t)
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function CheckrideCard({ goalId, passed }: { goalId: CheckrideGoalId; passed: Checkride | undefined }) {
  const goal = goalById(goalId)
  const logCheckride = useLogCheckride()
  const removeCheckride = useRemoveCheckride()
  const [removing, setRemoving] = useState(false) // asking whether to remove the passed checkride
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  // closed: the plan's name and Log checkride; open: grown, with the rest; closing: shrinking back.
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed')
  const card = useRef<HTMLElement>(null)
  const details = useRef<HTMLDivElement>(null)
  const row = useRef<HTMLDivElement>(null) // the closed card's row (fades back in)
  const closedHeight = useRef(0)

  const open = () => {
    const el = card.current
    if (!el || phase !== 'closed') return
    logCheckride.reset()
    setVisibility('public')
    closedHeight.current = el.offsetHeight
    setPhase('open')
  }

  // Grown: from its closed height to its new one, with the page scrolling down so all of it
  // shows above the tab bar (but not past its top); then a pop, and the details fade up in.
  useLayoutEffect(() => {
    const el = card.current
    if (phase !== 'open' || !el) return
    const page = el.closest<HTMLElement>('.page')
    const from = closedHeight.current
    const to = el.offsetHeight
    if (page) {
      const box = page.getBoundingClientRect()
      const visibleBottom = box.bottom - parseFloat(getComputedStyle(page).paddingBottom) + 16
      const top = el.getBoundingClientRect().top
      scrollAlong(page, Math.max(0, Math.min(top + to - visibleBottom, top - box.top - 16)))
    }
    if (reducedMotion()) return
    el.animate(
      [
        { height: `${from}px`, overflow: 'hidden', easing: EXPAND_EASING },
        { height: `${to}px`, overflow: 'hidden', transform: 'scale(1)', offset: 0.7, easing: 'ease-in-out' },
        { height: `${to}px`, transform: `scale(${POP_SCALE})`, offset: 0.85, easing: 'ease-in-out' },
        { height: `${to}px`, transform: 'scale(1)' },
      ],
      { duration: EXPAND_MS + POP_MS * 0.6 },
    )
    details.current?.animate(
      [
        { opacity: 0, transform: 'translateY(-6px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 240, delay: EXPAND_MS * 0.35, easing: 'ease-out', fill: 'backwards' },
    )
  }, [phase])

  // Back: the details fade as the card shrinks to its closed height and the page scrolls back.
  // Back (Cancel, or once logged): the details fade out where they are; then the card shows its
  // row again (passed, once logged) and shrinks from its open height to the row's own, as the
  // row fades in. The page stays scrolled to the bottom as it shrinks.
  const collapseFrom = useRef<number | null>(null) // the open height, to shrink from
  const close = () => {
    const el = card.current
    if (!el || phase !== 'open') return
    const done = () => {
      collapseFrom.current = el.offsetHeight
      setPhase('closed')
    }
    if (reducedMotion()) return done()
    setPhase('closing')
    const fade = details.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-in', fill: 'forwards' })
    if (fade) fade.onfinish = done
    else done()
  }
  useLayoutEffect(() => {
    const el = card.current
    const from = collapseFrom.current
    if (phase !== 'closed' || !el || from === null) return
    collapseFrom.current = null
    if (reducedMotion()) return
    const to = el.offsetHeight
    // The page stays where it is, scrolled to the bottom: as the card shrinks, what's above it
    // comes down with it. Without this, the page would jump up to its new end at once.
    const page = el.closest<HTMLElement>('.page')
    const fromBottom = page ? page.scrollHeight - page.clientHeight - page.scrollTop : 0
    const shrink = el.animate(
      [
        { height: `${from}px`, overflow: 'hidden' },
        { height: `${to}px`, overflow: 'hidden' },
      ],
      { duration: EXPAND_MS, easing: EXPAND_EASING },
    )
    if (page) {
      const keep = () => {
        page.scrollTop = page.scrollHeight - page.clientHeight - fromBottom
        if (shrink.playState === 'running') requestAnimationFrame(keep)
      }
      keep()
    }
    row.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 60, easing: 'ease-out', fill: 'backwards' })
  }, [phase])

  const log = () => logCheckride.mutate({ goal: goalId, visibility }, { onSuccess: close })

  return (
    <section ref={card} className={`card ${styles.card} ${styles.checkride}`}>
      <h2>Checkride</h2>
      {/* Keyed, so the two never share an element (the closing fade would stay on the row). */}
      {phase === 'closed' ? (
        passed ? (
          // Passed: like a finished requirement (full green bar, a check), with when it was
          // passed where the others have their numbers. Tapping that offers to remove it.
          <div key="passed" ref={row} className={`${barStyles.row} ${barStyles.done} ${styles.passedRow}`}>
            <div className={barStyles.labels}>
              <span className={barStyles.label}>
                {goal.title}
                <Check size={14} strokeWidth={2.5} aria-label="passed" />
              </span>
              <button type="button" className={styles.passedButton} onClick={() => setRemoving(true)}>
                Passed {formatDate(passed.passedOn)}
              </button>
            </div>
            <div className={barStyles.track} aria-hidden>
              <div className={barStyles.fill} style={{ width: '100%' }} />
            </div>
          </div>
        ) : (
          <div key="row" ref={row} className={styles.checkrideRow}>
            <span className={styles.planName}>{goal.title}</span>
            <button type="button" className={`btn btn--primary ${styles.checkrideButton}`} onClick={open}>
              Log checkride
            </button>
          </div>
        )
      ) : (
        <div key="details" ref={details} className={styles.checkrideDetails}>
          <Award size={64} strokeWidth={1.5} className={styles.ribbon} aria-hidden />
          <p className={styles.congrats}>
            Congratulations on passing your checkride and earning your {ratingName(goal.title)}!
          </p>
          <div className={styles.visibility}>
            <span>Visibility</span>
            <Segmented<'public' | 'private'>
              label="Visibility"
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: 'public', label: 'Public' },
                { value: 'private', label: 'Private' },
              ]}
            />
            <p className={styles.hint}>
              {visibility === 'public' ? 'Your friends will see it in their feed.' : 'Only you will see it.'}
            </p>
          </div>
          {logCheckride.error && <p className="error-text">{logCheckride.error.message}</p>}
          <div className={styles.checkrideActions}>
            <button type="button" className="btn btn--lg" onClick={close} disabled={logCheckride.isPending || phase === 'closing'}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--lg btn--primary"
              onClick={log}
              disabled={logCheckride.isPending || phase === 'closing'}
            >
              {logCheckride.isPending ? 'Logging…' : 'Log Checkride'}
            </button>
          </div>
        </div>
      )}

      {passed && (
        <ConfirmDialog
          open={removing}
          title="Remove this checkride?"
          confirmLabel="Remove"
          busyLabel="Removing…"
          busy={removeCheckride.isPending}
          error={removeCheckride.error?.message}
          danger
          onConfirm={() => removeCheckride.mutate(passed.id, { onSuccess: () => setRemoving(false) })}
          onCancel={() => {
            setRemoving(false)
            removeCheckride.reset()
          }}
        >
          It will be taken out of your flights and the feed, along with its props and comments.
        </ConfirmDialog>
      )}
    </section>
  )
}

// The goals in the picker: the certificates and ratings, then No Specific Goal.
const GOAL_OPTIONS = [...GOALS.filter((g) => g.id !== 'none'), ...GOALS.filter((g) => g.id === 'none')].map((g) => ({
  value: g.id,
  label: g.title,
}))

// Update: pick the goal, and set any stat by hand (each starts at what it shows now). What's
// set is saved as the difference from what the flights add up to, so flights logged later
// still add to it.
//
// Set Your Goal (`setup`, a new account with no goal yet) is the same, except nothing is picked
// to start with: the stats show once a goal is. There's no Cancel. Saving shows the goal's progress, as Update does.
function GoalEditor({
  settings,
  flights,
  aircraft,
  onDone,
  setup = false,
}: {
  settings: GoalSettings
  flights: Flight[]
  aircraft: Map<string, Aircraft>
  onDone: () => void
  setup?: boolean
}) {
  const save = useSaveGoal()
  const [goalId, setGoalId] = useState<GoalId | null>(settings.goal)
  const [atpRequiredHours, setAtpRequiredHours] = useState(settings.atpRequiredHours)
  // Typed values by stat key; a stat not typed in shows what it shows now.
  const [values, setValues] = useState<Record<string, string>>({})

  const goal = goalById(goalId ?? 'none')
  const computed = goal.progress(flights, aircraft, { atpRequiredHours })
  const shown = adjusted(computed, settings.adjustments)
  const all = (p: GoalProgress) => [p.total, ...p.sections.flatMap((s) => s.items)]
  const shownValue = new Map(all(shown).map((r) => [r.key, r.value]))
  const valueOf = (r: Requirement) => values[r.key] ?? format(r, shownValue.get(r.key) ?? 0)

  const submit = () => {
    if (!goalId) return
    const adjustments = { ...settings.adjustments }
    for (const r of all(computed)) {
      const entered = Number(valueOf(r))
      if (!Number.isFinite(entered) || entered < 0) continue
      adjustments[r.key] = Math.round((entered - r.value) * 10) / 10
    }
    save.mutate({ goal: goalId, adjustments, atpRequiredHours }, { onSuccess: onDone })
  }

  const field = (r: Requirement, labelClassName?: string) => (
    <Stepper
      key={r.key}
      label={r.label}
      labelClassName={labelClassName}
      value={valueOf(r)}
      step={r.unit === 'hours' ? 0.1 : 1}
      max={99999}
      onChange={(v) => setValues((vs) => ({ ...vs, [r.key]: v }))}
    />
  )

  return (
    <>
      <PageHeader
        title={setup ? 'Set Your Goal' : 'Update Goal'}
        className={listStyles.topHeader}
        action={
          <>
            {!setup && (
              <button type="button" className="btn btn--ghost" onClick={onDone} disabled={save.isPending}>
                Cancel
              </button>
            )}
            <button type="button" className="btn btn--primary" onClick={submit} disabled={save.isPending || !goalId}>
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      />
      <div className="page">
        {save.error && <p className="error-text">{save.error.message}</p>}
        <section className={`card ${styles.card} ${styles.editCard} ${styles.goalCard}`}>
          <Select
            label="Goal"
            value={goalId ?? ''}
            placeholder="Choose a goal"
            showAll
            onChange={(id) => setGoalId(id as GoalId)}
            options={GOAL_OPTIONS}
          />
          <p className={styles.hint}>{goalId ? goal.subtitle : 'What are you working toward? You can change it any time.'}</p>
          {goalId === 'atp' && (
            <Select
              label="Required hours"
              value={String(atpRequiredHours)}
              onChange={(v) => setAtpRequiredHours(Number(v) as AtpRequiredHours)}
              options={ATP_HOURS_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
            />
          )}
        </section>

        {goalId && (
          <>
            <section className={`card ${styles.card} ${styles.editCard}`}>
              <h2>Your stats</h2>
              <p className={styles.hint}>Set any of these to include time from before Hobbs. Flights you log later will add to them.</p>
              {field(shown.total, styles.totalLabel)}
            </section>
            {shown.sections.map((section) => (
              <section key={section.title} className={`card ${styles.card} ${styles.editCard}`}>
                <h2>{section.title}</h2>
                {section.items.map((r) => field(r))}
              </section>
            ))}
          </>
        )}
      </div>
    </>
  )
}

const format = (r: Requirement, n: number) => (r.unit === 'hours' ? n.toFixed(1) : String(n))
