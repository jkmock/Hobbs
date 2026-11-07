import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronLeft, LogOut, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Segmented } from '../components/controls'
import { useTheme, type Theme } from '../lib/theme'
import { useLogout } from '../hooks/useAuth'
import { useCreateInstructor, useDeleteInstructor, useInstructors } from '../hooks/useLookups'
import styles from './SettingsPage.module.css'

export default function SettingsPage() {
  const navigate = useNavigate()
  const logout = useLogout()
  const [theme, setTheme] = useTheme()
  const { data: instructors = [] } = useInstructors()
  const createInstructor = useCreateInstructor()
  const deleteInstructor = useDeleteInstructor()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const addInstructor = (e: FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return
    createInstructor.mutate(
      { firstName: firstName.trim(), lastName: lastName.trim() },
      {
        onSuccess: () => {
          setFirstName('')
          setLastName('')
        },
      },
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        leading={
          <Link to="/profile" className="icon-btn" aria-label="Back to profile">
            <ChevronLeft size={24} />
          </Link>
        }
      />

      <h2 className="section-title">Appearance</h2>
      <Segmented<Theme>
        label="Theme"
        value={theme}
        onChange={setTheme}
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />

      <h2 className="section-title">Instructors</h2>
      <div className="card">
        {instructors.length === 0 && <p className={`muted ${styles.row}`}>No instructors yet.</p>}
        {instructors.map((instructor) => (
          <div key={instructor.id} className={styles.row}>
            <span>
              {instructor.firstName} {instructor.lastName}
            </span>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove ${instructor.firstName} ${instructor.lastName}`}
              onClick={() => deleteInstructor.mutate(instructor.id)}
            >
              <X size={18} />
            </button>
          </div>
        ))}
        <form className={styles.addRow} onSubmit={addInstructor}>
          <input
            className="input"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            aria-label="Instructor first name"
          />
          <input
            className="input"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            aria-label="Instructor last name"
          />
          <button className="btn" disabled={createInstructor.isPending}>
            Add
          </button>
        </form>
      </div>
      {deleteInstructor.error && <p className="error-text">{deleteInstructor.error.message}</p>}
      {createInstructor.error && <p className="error-text">{createInstructor.error.message}</p>}

      <h2 className="section-title">Account</h2>
      <button
        type="button"
        className="btn btn--block btn--danger"
        onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
      >
        <LogOut size={16} /> Log out
      </button>
    </div>
  )
}
