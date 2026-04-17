import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 pt-16 pb-20">
      <div className="text-center mb-12">
        <h1 className="text-[32px] font-extrabold tracking-tight">Terms of Service</h1>
        <p className="text-[14px] text-text-muted mt-2">Last updated: April 6, 2026</p>
      </div>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">1. Acceptance of Terms</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          By using Rabona, you agree to these terms. If you do not agree, do not use the service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">2. Eligibility</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          You must be at least 13 years old to use Rabona. By signing up, you confirm that you meet this requirement.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">3. Your Account</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          You are responsible for your account and all activity under it. Do not share your login credentials. You may only create one account per person.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">4. Acceptable Use</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          You agree not to use Rabona to harass, bully, or threaten other users; post illegal, obscene, or harmful content; impersonate other people; spam or send unsolicited messages; attempt to access other users&apos; accounts; or interfere with the operation of the service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">5. Your Content</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          You own the content you post on Rabona. By posting, you grant us a license to display and distribute your content within the platform. You can delete your content at any time. We may remove content that violates these terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">6. Termination</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          We may suspend or terminate your account if you violate these terms. You may delete your account at any time through the settings page, which will permanently remove all your data.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">7. Disclaimer</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          Rabona is provided &quot;as is&quot; without warranties of any kind. We are not responsible for user-generated content. We do not guarantee that the service will be available at all times.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">8. Changes to These Terms</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          We may update these terms from time to time. Continued use of Rabona after changes constitutes acceptance of the updated terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">9. Contact</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          If you have questions about these terms, contact us at{' '}
          <a href="mailto:keugenelee11@gmail.com" className="text-accent">keugenelee11@gmail.com</a>.
        </p>
      </section>

      <div className="text-center pt-4 border-t border-border">
        <Link href="/about" className="text-accent text-[14px] font-semibold press">
          Back to About
        </Link>
      </div>
    </div>
  )
}
