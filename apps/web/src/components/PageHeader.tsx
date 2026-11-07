import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

type Props = {
  title: string
  subtitle?: string
  leading?: ReactNode // e.g. a back button
  action?: ReactNode
}

export default function PageHeader({ title, subtitle, leading, action }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        {leading}
        <div>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </header>
  )
}
