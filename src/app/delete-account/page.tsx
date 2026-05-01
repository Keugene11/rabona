import Link from 'next/link'

export const metadata = {
  title: 'Delete your account — Rabona',
  description: 'How to permanently delete your Rabona account and all associated data.',
}

const SUPPORT_EMAIL = 'keugenelee11@gmail.com'
const MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Delete my Rabona account')}&body=${encodeURIComponent(
  'Please delete my Rabona account and all associated data.\n\nAccount email (the one you used to sign in with Google or Apple):\n',
)}`

export default function DeleteAccountPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 pt-16 pb-20">
      <div className="text-center mb-10">
        <h1 className="text-[32px] font-extrabold tracking-tight">Delete your account</h1>
        <p className="text-[14px] text-text-muted mt-2">
          You can permanently delete your Rabona account and all associated data at any time.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">If you can sign in</h2>
        <ol className="text-[14px] text-text-muted leading-relaxed space-y-1 list-decimal pl-5">
          <li>Open the app and sign in.</li>
          <li>
            Go to <span className="text-text font-medium">Settings</span> &rarr;{' '}
            <span className="text-text font-medium">Delete Account</span>.
          </li>
          <li>Type &ldquo;DELETE&rdquo; to confirm.</li>
        </ol>
        <p className="text-[14px] text-text-muted leading-relaxed mt-3">
          Deletion is immediate and irreversible.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">If you can&rsquo;t sign in</h2>
        <p className="text-[14px] text-text-muted leading-relaxed mb-3">
          Email{' '}
          <a href={MAILTO} className="text-accent">
            {SUPPORT_EMAIL}
          </a>{' '}
          from the address tied to your Google or Apple sign-in. Include any usernames you used so we can verify
          ownership. We&rsquo;ll delete the account within 30 days and reply to confirm.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">What gets deleted</h2>
        <ul className="text-[14px] text-text-muted leading-relaxed space-y-1 list-disc pl-5">
          <li>Your profile (name, photo, bio, all profile fields)</li>
          <li>All wall posts, comments, and likes you authored</li>
          <li>All direct messages you sent</li>
          <li>Uploaded photos and videos</li>
          <li>Friend connections, friend requests, and pokes</li>
          <li>Your authentication record</li>
        </ul>
        <p className="text-[14px] text-text-muted leading-relaxed mt-3">
          Nothing is retained for analytics or backups beyond what&rsquo;s required by law. Replies and messages other
          users sent to you remain on their accounts; messages you sent are removed.
        </p>
      </section>

      <div className="text-center pt-4 border-t border-border">
        <Link href="/" className="text-accent text-[14px] font-semibold press">
          Back to Rabona
        </Link>
      </div>
    </div>
  )
}
