import { useState } from 'react'
import { Avatar, Select, Stepper } from '../../components/controls'
import { useCreateInstructor, useInstructors } from '../../hooks/useLookups'
import { LANDING_FIELDS, type StepProps } from './draft'
import styles from './LogFlight.module.css'

export default function LandingsStep({ draft, update, errors }: StepProps) {
  return (
    <>
      <section className={`card ${styles.panel} ${styles.landingsCard}`}>
        <h2 className={styles.cardTitle}>Landings</h2>
        {LANDING_FIELDS.map(([key, label]) => (
          <Stepper
            key={key}
            label={label}
            value={draft.landings[key]}
            step={1}
            max={99}
            error={errors[key]}
            onChange={(value) => update({ landings: { ...draft.landings, [key]: value } })}
          />
        ))}
      </section>

      <section className={`card ${styles.panel}`}>
        <h2 className={styles.cardTitle}>Optional</h2>
        <InstructorPicker value={draft.instructorId} onChange={(instructorId) => update({ instructorId })} />

        <label className="field">
          <span>Notes</span>
          <textarea
            className="input"
            value={draft.notes}
            maxLength={500}
            placeholder="Steep turns, slow flight, first solo…"
            onChange={(e) => update({ notes: e.target.value })}
          />
          {errors.notes && <span className="error-text">{errors.notes}</span>}
        </label>
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
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault() // Enter saves the instructor here instead of moving to the next field
            save()
          }}
          onBlur={() => !name.trim() && setAdding(false)}
        />
        {create.error && <span className="error-text">{create.error.message}</span>}
      </label>
    )
  }

  return (
    <Select
      label="Instructor"
      value={value}
      onChange={onChange}
      options={[
        { value: '', label: 'None' },
        ...instructors.map((i) => ({
          value: i.id,
          label: `${i.firstName} ${i.lastName}`,
          leading: <Avatar firstName={i.firstName} lastName={i.lastName} size={28} />,
        })),
      ]}
      action={{ label: 'Add instructor', onSelect: () => setAdding(true) }}
    />
  )
}
