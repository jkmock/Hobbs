import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="app page">
      <div className="empty">
        <p>That page doesn't exist.</p>
        <Link to="/" className="btn">
          Back to Hobbs
        </Link>
      </div>
    </div>
  )
}
