import { Link } from 'react-router'
import InfoPage from './InfoPage'
import infoStyles from './InfoPage.module.css'
import { SUPPORT_EMAIL } from '../lib/support'

// The Terms of Use everyone agrees to when they sign up (AuthShell). Apple asks apps where people
// post for terms that make clear there's no tolerance for objectionable content or abusive users
// (App Review Guideline 1.2).
export default function TermsPage() {
  return (
    <InfoPage title="Terms of Use" titleInCard>
      <p className={infoStyles.updated}>Last updated November 17, 2026</p>

      <h2>Using Hobbs</h2>
      <p>
        Hobbs is a logbook and a place to share flights with friends. By creating an account or using Hobbs, you agree
        to these terms. If you don’t agree, please don’t use Hobbs.
      </p>
      <p>
        You must be at least 13 years old to use Hobbs. Keep your login to yourself; you’re responsible for what happens
        on your account.
      </p>

      <h2>No tolerance for objectionable content or abuse</h2>
      <p>Hobbs has zero tolerance for objectionable content and abusive users. You may not post, comment or send:</p>
      <ul>
        <li>Harassment, bullying, threats, or hate toward anyone, including for their race, ethnicity, religion, gender, sexual orientation, disability or age</li>
        <li>Sexual, pornographic, violent or graphic content</li>
        <li>Spam, scams, or misleading content</li>
        <li>Anything illegal, or that encourages unsafe or illegal flying</li>
        <li>Anyone else’s private information, or content you don’t have the right to share</li>
      </ul>
      <p>
        Names, profile pictures, comments and flight notes all count. Hobbs filters some objectionable words
        automatically, but you’re responsible for what you post.
      </p>

      <h2>Reporting and blocking</h2>
      <p>
        Tap the ⋯ on any post, comment or person to report it or block them. Reported content is hidden from you right
        away, and we review every report within 24 hours. When content breaks these terms we remove it, and we suspend
        the accounts of people who post it. Blocking someone means neither of you sees the other’s posts, comments or
        props, and they can’t send you friend requests.
      </p>

      <h2>Your content</h2>
      <p>
        Your flights, posts and comments are yours. You give Hobbs permission to store them and show them to the people
        you share them with (your friends, for public posts) so the app can work. Private flights are only shown to you.
      </p>

      <h2>Your logbook</h2>
      <p>
        Hobbs helps you keep track of your flying, but it doesn’t replace the logbook or records the FAA or any other
        authority requires. You’re responsible for the accuracy of your entries and for meeting any logging requirements.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time in Settings, which deletes your logbook, posts and comments. We may
        suspend or end accounts that break these terms.
      </p>

      <h2>No warranty</h2>
      <p>
        Hobbs is provided as is, without warranties of any kind. To the extent the law allows, Hobbs isn’t liable for
        indirect or consequential damages from using it.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms, and will change the date above when we do. Questions? Email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or see <Link to="/support">Support</Link>.
      </p>
    </InfoPage>
  )
}
