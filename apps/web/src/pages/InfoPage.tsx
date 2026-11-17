import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import listStyles from '../components/FlightList.module.css'
import styles from './InfoPage.module.css'

// The frame for a page of reading, open signed in or not (the Terms are linked from sign-up):
// a title, Back, and the text in a card. With titleInCard the title heads the card instead of
// the page, leaving only Back above it.
export default function InfoPage({
  title,
  titleInCard = false,
  children,
}: {
  title: string
  titleInCard?: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  // Back where you came from; opened straight from a link, to the app's start.
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/', { replace: true }))
  return (
    <>
      <PageHeader
        title={titleInCard ? undefined : title}
        className={listStyles.topHeader}
        leading={
          <button type="button" className={`btn ${listStyles.headerButton}`} onClick={back}>
            <ArrowLeft size={22} /> Back
          </button>
        }
      />
      <div className="page">
        <article className={`card ${styles.card}`}>
          {titleInCard && <h1 className={styles.title}>{title}</h1>}
          {children}
        </article>
      </div>
    </>
  )
}
