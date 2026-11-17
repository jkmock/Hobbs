import { Link } from 'react-router'
import InfoPage from './InfoPage'
import { SUPPORT_EMAIL } from '../lib/support'

// Getting help, reporting and blocking, and deleting your account. Public, so it can be the
// App Store's support link (hobbsflight.com/support).
export default function SupportPage() {
  return (
    <InfoPage title="Support" titleInCard>
      <h2>Contact us</h2>
      <p>
        Questions, problems or feedback: email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We usually reply
        within a day.
      </p>

      <h2>Report a post, comment or person</h2>
      <p>
        Tap the ⋯ next to the post, comment or person’s name and choose Report. It’s hidden from you straight away, and
        we review every report within 24 hours, removing content and suspending accounts that break the{' '}
        <Link to="/terms">Terms of Use</Link>. For anything urgent, email us too.
      </p>

      <h2>Block someone</h2>
      <p>
        Tap the ⋯ next to their post, comment or name and choose Block. You won’t see each other’s posts, comments or
        props, and they can’t send you friend requests. They aren’t told. To unblock them, go to Settings.
      </p>

      <h2>Delete your account</h2>
      <p>
        In the app, go to Profile, then Settings, then Delete account. This deletes your logbook, flights, friends, props
        and comments for good.
      </p>
    </InfoPage>
  )
}
