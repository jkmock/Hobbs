import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <section>
      <h1>Page not found</h1>
      <Link to="/">Back to your logbook</Link>
    </section>
  )
}
