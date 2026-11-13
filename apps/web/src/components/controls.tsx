import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { formatDate, initials, todayIso } from '../lib/format'
import styles from './controls.module.css'

// A number with − and + buttons. The value is a string so typing "1." isn't rewritten mid-edit.
type StepperProps = {
  label: string
  value: string
  onChange: (value: string) => void
  step?: number // 0.1 for hours, 1 for counts
  max?: number
  error?: string
  labelClassName?: string // extra styling from the page, e.g. a bigger label for Total time
  // When given, the label is a button that does this (the hours rows: total time <-> 0),
  // described to screen readers by labelAction, e.g. "Set PIC to total time".
  onLabelClick?: () => void
  labelAction?: string
}

export function Stepper({
  label,
  value,
  onChange,
  step = 0.1,
  max = 24,
  error,
  labelClassName = '',
  onLabelClick,
  labelAction,
}: StepperProps) {
  const decimals = step < 1 ? 1 : 0
  const zero = (0).toFixed(decimals)
  // Focusing the box empties it so you can type straight away (Enter from the field before
  // lands here too). Until something is typed the real value is untouched, and leaving
  // without typing keeps it. Erasing what you typed leaves it empty while you're in it;
  // leaving it empty makes it 0. An empty value you're not in (a new leg's time) shows as 0.
  const [blank, setBlank] = useState(false)
  const [focused, setFocused] = useState(false)
  const shown = blank ? '' : !focused && value.trim() === '' ? zero : value
  const bump = (direction: 1 | -1) => {
    const current = Number(value) || 0
    const next = Math.min(max, Math.max(0, current + direction * step))
    onChange(next.toFixed(decimals))
  }

  return (
    <div className={styles.stepperRow}>
      {onLabelClick ? (
        <div className={`${styles.stepperLabel} ${labelClassName}`}>
          <button type="button" className={styles.labelButton} onClick={onLabelClick} aria-label={labelAction}>
            {label}
          </button>
          {error && <span className="error-text">{error}</span>}
        </div>
      ) : (
        <label className={`${styles.stepperLabel} ${labelClassName}`}>
          {label}
          {error && <span className="error-text">{error}</span>}
        </label>
      )}
      <div className={`${styles.stepper} ${Number(value) ? styles.filled : ''} ${error ? styles.invalid : ''}`}>
        <button type="button" onClick={() => bump(-1)} aria-label={`Decrease ${label}`}>
          <Minus size={16} />
        </button>
        <input
          className="mono"
          inputMode={decimals ? 'decimal' : 'numeric'}
          value={shown}
          onChange={(e) => {
            setBlank(false)
            onChange(e.target.value)
          }}
          onFocus={() => {
            setFocused(true)
            setBlank(true)
          }}
          onBlur={() => {
            setFocused(false)
            if (blank) return setBlank(false) // nothing typed: keep the value
            if (value.trim() === '') return onChange(zero) // typed and then erased: 0
            // Tidy what was typed into the usual form: 0 -> 0.0, 1 -> 1.0, 1. -> 1.0.
            // Anything that isn't a number is left for validation to point out.
            const n = Number(value)
            if (Number.isFinite(n) && n.toFixed(decimals) !== value) onChange(n.toFixed(decimals))
          }}
          aria-label={label}
        />
        <button type="button" onClick={() => bump(1)} aria-label={`Increase ${label}`}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

type SegmentedProps<T extends string> = {
  label: string
  options: { value: T; label: string }[]
  value: T | null
  onChange: (value: T) => void
  onClear?: () => void // when given, tapping the selected option unselects it
}

export function Segmented<T extends string>({ label, options, value, onChange, onClear }: SegmentedProps<T>) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => (onClear && value === option.value ? onClear() : onChange(option.value))}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Avatar({ firstName, lastName, size = 40, className = '' }: { firstName: string; lastName: string; size?: number; className?: string }) {
  return (
    <span className={`${styles.avatar} ${className}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials(firstName, lastName)}
    </span>
  )
}

// A date in the same row layout as Stepper: label on the left, the date on the right. Tapping
// the date opens a small calendar under it. Dates after today can't be picked.
type DateFieldProps = {
  label: string
  value: string // "2026-11-04"
  onChange: (value: string) => void
  error?: string
  labelClassName?: string // extra styling from the page, e.g. to match a card heading
  buttonClassName?: string
}

export function DateField({ label, value, onChange, error, labelClassName = '', buttonClassName = '' }: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useDismiss(open, ref, () => setOpen(false))

  return (
    <div className={styles.stepperRow}>
      <span className={`${styles.stepperLabel} ${labelClassName}`}>
        {label}
        {error && <span className="error-text">{error}</span>}
      </span>
      <div className={styles.dateField} ref={ref}>
        <button
          type="button"
          className={`${styles.dateButton} ${error ? styles.invalid : ''} ${buttonClassName}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${label}: ${value ? formatDate(value) : 'not set'}`}
          onClick={() => setOpen(!open)}
        >
          <CalendarDays size={16} aria-hidden />
          {value ? formatDate(value) : 'Pick a date'}
        </button>
        {open && (
          <Calendar
            value={value}
            onPick={(date) => {
              onChange(date)
              setOpen(false)
            }}
          />
        )}
      </div>
    </div>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}` // m is 0-based
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function Calendar({ value, onPick }: { value: string; onPick: (date: string) => void }) {
  const today = todayIso()
  // Opens on the selected date's month (or this month).
  const [month, setMonth] = useState(() => {
    const [y, m] = (value || today).split('-').map(Number) as [number, number]
    return { y, m: m - 1 }
  })

  const first = new Date(month.y, month.m, 1)
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const shift = (by: number) => {
    const d = new Date(month.y, month.m + by, 1)
    setMonth({ y: d.getFullYear(), m: d.getMonth() })
  }
  const isCurrentMonth = iso(month.y, month.m, 1) >= `${today.slice(0, 8)}01` // no paging into the future

  return (
    <div className={styles.calendar} role="dialog" aria-label="Choose a date">
      <div className={styles.calendarHead}>
        <button type="button" className={styles.calendarNav} onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <span className={styles.calendarMonth}>
          {first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          className={styles.calendarNav}
          onClick={() => shift(1)}
          disabled={isCurrentMonth}
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className={styles.calendarGrid}>
        {WEEKDAYS.map((day, i) => (
          <span key={i} className={styles.weekday} aria-hidden>
            {day}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <span key={i} />
          const date = iso(month.y, month.m, day)
          return (
            <button
              key={i}
              type="button"
              className={styles.day}
              aria-pressed={date === value}
              data-today={date === today || undefined}
              disabled={date > today}
              onClick={() => onPick(date)}
            >
              {day}
            </button>
          )
        })}
      </div>
      <button type="button" className={`btn btn--ghost btn--sm ${styles.todayButton}`} onClick={() => onPick(today)}>
        Today
      </button>
    </div>
  )
}

// Closes a popover on a tap outside `ref` or on Escape.
function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close // the latest close, without re-adding the listeners every render
  })
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && closeRef.current()
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, ref])
}

// A dropdown styled like the rest of the app, in place of the browser's own <select>. The list
// opens under the button, or above it when there isn't room below. An optional action (like
// "Add instructor") sits at the bottom of the list, set apart from the options.
type SelectOption = { value: string; label: string; leading?: ReactNode }
type SelectProps = {
  label: ReactNode
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  action?: { label: string; onSelect: () => void }
}

export function Select({ label, value, options, onChange, action }: SelectProps) {
  const [open, setOpen] = useState(false)
  const [above, setAbove] = useState(false)
  const [active, setActive] = useState(0) // highlighted row, for the keyboard
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = () => setOpen(false)
  useDismiss(open, ref, close)

  const rows = action ? options.length + 1 : options.length // the action is the last row
  const selected = options.find((o) => o.value === value)

  const show = () => {
    // Opens upward when the list (up to 280px) wouldn't fit under the button.
    const box = ref.current?.getBoundingClientRect()
    setAbove(!!box && window.innerHeight - box.bottom < 300 && box.top > window.innerHeight - box.bottom)
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const pick = (row: number) => {
    if (row === options.length) action?.onSelect()
    else onChange(options[row]!.value)
    close()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        show()
      }
      return
    }
    if (e.key === 'ArrowDown') setActive((a) => Math.min(rows - 1, a + 1))
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1))
    else if (e.key === 'Enter' || e.key === ' ') pick(active)
    else if (e.key === 'Tab') return close()
    else return
    e.preventDefault()
  }

  return (
    <div className="field">
      <span id={`${id}-label`}>{label}</span>
      <div className={styles.select} ref={ref}>
        <button
          type="button"
          className={`input ${styles.selectButton}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${id}-label ${id}-value`}
          aria-activedescendant={open ? `${id}-${active}` : undefined}
          onClick={() => (open ? close() : show())}
          onKeyDown={onKeyDown}
        >
          {selected?.leading}
          <span id={`${id}-value`} className={styles.selectValue}>
            {selected?.label ?? ''}
          </span>
          <ChevronDown size={18} className={styles.selectChevron} data-open={open || undefined} aria-hidden />
        </button>
        {open && (
          <ul className={styles.selectList} role="listbox" aria-labelledby={`${id}-label`} data-above={above || undefined}>
            {options.map((option, i) => (
              <li
                key={option.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={option.value === value}
                data-active={i === active || undefined}
                className={styles.selectOption}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(i)}
              >
                {option.leading}
                <span className={styles.selectValue}>{option.label}</span>
                {option.value === value && <Check size={16} className={styles.selectCheck} aria-hidden />}
              </li>
            ))}
            {action && (
              <li
                id={`${id}-${options.length}`}
                role="option"
                aria-selected={false}
                data-active={active === options.length || undefined}
                className={`${styles.selectOption} ${styles.selectAction}`}
                onPointerEnter={() => setActive(options.length)}
                onClick={() => pick(options.length)}
              >
                <span className={styles.selectActionIcon}>
                  <Plus size={16} aria-hidden />
                </span>
                {action.label}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
