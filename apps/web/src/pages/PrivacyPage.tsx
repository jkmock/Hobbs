import { Link } from 'react-router'
import InfoPage from './InfoPage'
import infoStyles from './InfoPage.module.css'
import { SUPPORT_EMAIL } from '../lib/support'

// The privacy policy: what Hobbs collects, why, who else sees it, and how to delete it. Linked
// from sign-up, Settings and the App Store listing (hobbsflight.com/privacy), which Apple
// requires of every app.
export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy Policy" titleInCard>
      <p className={infoStyles.updated}>Last updated November 17, 2026</p>

      <p>
        Hobbs is a logbook for student pilots. This policy explains what information Hobbs collects, how it’s used, and
        the choices you have. Hobbs doesn’t sell your information, show ads, or track you across other apps and
        websites.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your name, email address, and password (stored only as a secure hash). If you
          sign in with Apple or Google, we receive your name, email address and an account identifier from them. With
          Apple’s Hide My Email, we only see the private relay address.
        </li>
        <li>
          <strong>Your profile picture,</strong> if you add one.
        </li>
        <li>
          <strong>Your logbook:</strong> the flights you log (dates, aircraft and tail numbers, routes and airports,
          times, landings, instructor names and notes), your goal, and the checkrides you record.
        </li>
        <li>
          <strong>Your activity with friends:</strong> your friends and friend requests, props, comments, and the
          people you block.
        </li>
        <li>
          <strong>Reports:</strong> when you report something, we keep the report, your reason, and a copy of what you
          reported.
        </li>
      </ul>
      <p>
        Hobbs doesn’t collect your location, contacts, or any data for advertising. The app uses a single sign-in
        cookie to keep you logged in, and no tracking cookies.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To run Hobbs: keep your logbook, work out your progress, and show your public posts to your friends.</li>
        <li>To keep Hobbs safe: review reports, remove content and suspend accounts that break the Terms of Use.</li>
        <li>To answer you when you contact support.</li>
      </ul>

      <h2>Who can see it</h2>
      <p>
        Your public flights and checkrides, your name and your profile picture are seen by your friends. Your name and
        picture can also be found by people searching for friends. Private flights are seen only by you. Comments you
        leave are seen by the post’s owner and their friends. Anyone you block can’t see you, and you can’t see them.
      </p>

      <h2>Services we use</h2>
      <p>Hobbs relies on a few providers, who handle data only to provide their service to Hobbs:</p>
      <ul>
        <li>Vercel hosts the app and its server, and Neon hosts its database.</li>
        <li>Apple and Google handle signing in when you choose them.</li>
        <li>
          FlightAware looks up flights and their tracks: when you look up a flight, the aircraft’s tail number is sent to FlightAware.
        </li>
        <li>OpenFreeMap provides the map tiles; your device loads them directly, as it does for any map.</li>
        <li>Resend sends Hobbs’s report notification emails, which can include reported content.</li>
      </ul>

      <h2>Keeping and deleting your data</h2>
      <p>
        We keep your information while you have an account. You can delete your account at any time in Settings: this
        permanently deletes your logbook, flights, checkrides, friends, props, comments and profile picture, and, if you
        signed in with Apple, revokes Hobbs’s access to your Apple account. Reports about content are kept for safety
        records after the content is removed.
      </p>

      <h2>Children</h2>
      <p>
        Hobbs isn’t for children under 13, and we don’t knowingly collect information from them. If you believe a child
        under 13 has an account, contact us and we’ll delete it.
      </p>

      <h2>Your rights</h2>
      <p>
        You can see and change your information in the app, and delete it by deleting your account. Depending on where
        you live, you may have more rights, such as getting a copy of your data. To ask, email us.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We’ll update the date above when this policy changes. Questions? Email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See also the <Link to="/terms">Terms of Use</Link>.
      </p>
    </InfoPage>
  )
}
