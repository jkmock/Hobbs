import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronRight, FileText, Heart, Lock, LogOut, Mail, ShieldAlert, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import { Avatar, Segmented } from '../components/controls'
import { useTheme, type Theme } from '../lib/theme'
import { avatarImage } from '../lib/avatarImage'
import { useBlock, useBlocks } from '../hooks/useModeration'
import { SUPPORT_EMAIL } from '../lib/support'
import { useDeleteAccount, useLogout, useMe, useRemoveAvatar, useSetAvatar, useUpdateName } from '../hooks/useAuth'
import type { User } from '../lib/types'
import { isObjectionable, OBJECTIONABLE_MESSAGE } from '@hobbs/shared'
import listStyles from '../components/FlightList.module.css'
import styles from './SettingsPage.module.css'

export default function SettingsPage() {
  const [theme, setTheme] = useTheme()
  const { data: user } = useMe()

  return (
    <>
      <PageHeader
        title="Settings"
        className={listStyles.topHeader}
        action={
          <Link to="/profile" className="btn btn--primary">
            Done
          </Link>
        }
      />
      <div className="page">
        {user && (
          <section className={`card ${styles.card}`}>
            <PhotoField user={user} />
            <NameField key={`${user.firstName} ${user.lastName}`} user={user} />
          </section>
        )}

        <section className={`card ${styles.card}`}>
          <h2 className={styles.cardTitle}>Appearance</h2>
          <Segmented<Theme>
            label="Appearance"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'Auto' }, // follows the phone's setting
            ]}
          />
        </section>

        <BlockedCard />
        <HelpCard isAdmin={!!user?.isAdmin} />
        <AccountCard />
      </div>
    </>
  )
}

// The people you've blocked, each with Unblock. (Blocking is from the ⋯ on someone's post,
// comment or name.)
function BlockedCard() {
  const blocks = useBlocks()
  const block = useBlock()
  if (!blocks.data?.length) return null
  return (
    <section className={`card ${styles.card}`}>
      <h2 className={styles.cardTitle}>Blocked</h2>
      <ul className={styles.people}>
        {blocks.data.map((p) => (
          <li key={p.id}>
            <Avatar person={p} size={36} />
            <span className={styles.personName}>
              {p.firstName} {p.lastName}
            </span>
            <button
              type="button"
              className="btn btn--sm"
              disabled={block.isPending && block.variables?.userId === p.id}
              onClick={() => block.mutate({ userId: p.id, unblock: true })}
            >
              Unblock
            </button>
          </li>
        ))}
      </ul>
      {block.error && <p className="error-text">{block.error.message}</p>}
    </section>
  )
}

// Getting in touch, the Terms of Use and Privacy Policy, and (for admins) the reports waiting to be reviewed.
function HelpCard({ isAdmin }: { isAdmin: boolean }) {
  return (
    <section className={`card ${styles.card}`}>
      <h2 className={styles.cardTitle}>Help</h2>
      <nav className={styles.links}>
        <a href={`mailto:${SUPPORT_EMAIL}`}>
          <Mail size={18} /> Email support <span className="muted">{SUPPORT_EMAIL}</span>
        </a>
        <Link to="/support">
          <Heart size={18} /> Support and safety <ChevronRight size={18} />
        </Link>
        <Link to="/terms">
          <FileText size={18} /> Terms of Use <ChevronRight size={18} />
        </Link>
        <Link to="/privacy">
          <Lock size={18} /> Privacy Policy <ChevronRight size={18} />
        </Link>
        {isAdmin && (
          <Link to="/admin/reports">
            <ShieldAlert size={18} /> Reports <ChevronRight size={18} />
          </Link>
        )}
      </nav>
    </section>
  )
}

// Log out and Delete account, each asking first.
function AccountCard() {
  const navigate = useNavigate()
  const logout = useLogout()
  const deleteAccount = useDeleteAccount()
  const [confirming, setConfirming] = useState<'logout' | 'delete' | null>(null)
  const close = () => {
    setConfirming(null)
    logout.reset()
    deleteAccount.reset()
  }

  return (
    <section className={`card ${styles.card}`}>
      <h2 className={styles.cardTitle}>Account</h2>
      <div className={styles.accountButtons}>
        <button type="button" className="btn btn--block" onClick={() => setConfirming('logout')}>
          <LogOut size={16} /> Log out
        </button>
        <button type="button" className="btn btn--block btn--danger" onClick={() => setConfirming('delete')}>
          <Trash2 size={16} /> Delete account
        </button>
      </div>

      <ConfirmDialog
        open={confirming === 'logout'}
        title="Log out?"
        confirmLabel="Log out"
        busyLabel="Logging out…"
        busy={logout.isPending}
        error={logout.error?.message}
        onConfirm={() => logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })}
        onCancel={close}
      >
        You can log back in any time.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirming === 'delete'}
        title="Delete your account?"
        confirmLabel="Delete account"
        busyLabel="Deleting…"
        busy={deleteAccount.isPending}
        error={deleteAccount.error?.message}
        danger
        onConfirm={() => deleteAccount.mutate(undefined, { onSuccess: () => navigate('/signup', { replace: true }) })}
        onCancel={close}
      >
        Your logbook, flights, friends, props and comments will be deleted for good. This can’t be undone.
      </ConfirmDialog>
    </section>
  )
}

// Your picture, with Change photo (pick one from the phone) and, once you have one, Remove.
function PhotoField({ user }: { user: User }) {
  const setAvatar = useSetAvatar()
  const removeAvatar = useRemoveAvatar()
  const [readError, setReadError] = useState<string | null>(null)
  const busy = setAvatar.isPending || removeAvatar.isPending
  const error = readError ?? setAvatar.error?.message ?? removeAvatar.error?.message

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // so picking the same photo again still counts as a change
    if (!file) return
    setReadError(null)
    try {
      setAvatar.mutate(await avatarImage(file))
    } catch (err) {
      setReadError(err instanceof Error ? err.message : 'Couldn’t read that photo.')
    }
  }

  return (
    <div className={styles.photo}>
      <Avatar person={user} size={88} className={styles.avatar} />
      <div className={styles.photoButtons}>
        {/* A label, so tapping it opens the photo picker. */}
        <label className={`btn btn--sm ${busy ? styles.disabled : ''}`} aria-disabled={busy || undefined}>
          {setAvatar.isPending ? 'Saving…' : user.avatarVersion ? 'Change photo' : 'Add photo'}
          <input type="file" accept="image/*" className={styles.fileInput} onChange={pick} disabled={busy} />
        </label>
        {user.avatarVersion && (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => removeAvatar.mutate()} disabled={busy}>
            Remove
          </button>
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}

// Your first and last name. Save appears once either is changed.
function NameField({ user }: { user: User }) {
  const updateName = useUpdateName()
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const changed = firstName.trim() !== user.firstName || lastName.trim() !== user.lastName
  const objectionable = isObjectionable(firstName) || isObjectionable(lastName)
  const valid = firstName.trim() !== '' && lastName.trim() !== '' && !objectionable

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (changed && valid) updateName.mutate({ firstName: firstName.trim(), lastName: lastName.trim() })
  }

  return (
    <form className={styles.name} onSubmit={save} noValidate>
      <div className={styles.nameFields}>
        <label className="field">
          <span>First name</span>
          <input className="input" autoComplete="given-name" maxLength={50} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </label>
        <label className="field">
          <span>Last name</span>
          <input className="input" autoComplete="family-name" maxLength={50} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </label>
      </div>
      {objectionable && <p className="error-text">{OBJECTIONABLE_MESSAGE}</p>}
      {updateName.error && <p className="error-text">{updateName.error.message}</p>}
      {changed && (
        <button className="btn btn--primary btn--block" disabled={!valid || updateName.isPending}>
          {updateName.isPending ? 'Saving…' : 'Save name'}
        </button>
      )}
    </form>
  )
}
