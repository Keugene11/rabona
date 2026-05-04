import Link from 'next/link'

export const metadata = {
  title: 'Child safety standards — Rabona',
  description:
    'Rabona’s standards against child sexual abuse and exploitation (CSAE), including reporting, enforcement, and contact information.',
}

const SUPPORT_EMAIL = 'keugenelee11@gmail.com'
const REPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  'Child safety report — Rabona',
)}&body=${encodeURIComponent(
  'Please describe what you saw and where (username, post link, message, etc.). Do not include screenshots of the content itself.\n\n',
)}`

export default function SafetyPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 pt-16 pb-20">
      <div className="text-center mb-10">
        <h1 className="text-[32px] font-extrabold tracking-tight">Child safety standards</h1>
        <p className="text-[14px] text-text-muted mt-2">
          Our standards against child sexual abuse and exploitation (CSAE).
        </p>
        <p className="text-[12px] text-text-muted mt-1">Last updated: May 4, 2026</p>
      </div>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">1. Zero tolerance</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          Rabona has zero tolerance for child sexual abuse material (CSAM) and any content, behavior, or solicitation
          that sexually exploits or endangers minors. This includes, without limitation: imagery or depictions of
          minors in a sexual context (real, drawn, AI-generated, or computer-rendered); grooming, sextortion, or
          attempts to engage a minor in sexual conversation; sharing or trading of CSAM; and the sexualization of
          minors in profile content, posts, comments, messages, or usernames.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">2. Minimum age</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          You must be at least 13 years old to use Rabona. Accounts found to belong to children under 13 will be
          removed. Where local law requires a higher age (for example, GDPR-K jurisdictions), users must meet that
          local minimum.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">3. How to report</h2>
        <p className="text-[14px] text-text-muted leading-relaxed mb-3">
          If you encounter content or behavior that violates these standards, report it immediately. Do not download,
          forward, or re-share the content.
        </p>
        <ul className="text-[14px] text-text-muted leading-relaxed space-y-1 list-disc pl-5">
          <li>
            Email{' '}
            <a href={REPORT_MAILTO} className="text-accent">
              {SUPPORT_EMAIL}
            </a>{' '}
            with the subject line &ldquo;Child safety report&rdquo;. Include the offending username and a link to the
            post, comment, or message where possible.
          </li>
          <li>
            In the app, you can block any user from their profile to immediately stop receiving content or messages
            from them.
          </li>
          <li>
            If a child is in immediate danger, contact local law enforcement first. In the United States, you can
            also report to the{' '}
            <a
              href="https://report.cybertip.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent"
            >
              NCMEC CyberTipline
            </a>
            .
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">4. What we do with reports</h2>
        <p className="text-[14px] text-text-muted leading-relaxed mb-3">
          Reports of CSAE are triaged ahead of all other moderation work. When a report is substantiated, we:
        </p>
        <ol className="text-[14px] text-text-muted leading-relaxed space-y-1 list-decimal pl-5">
          <li>Remove the offending content immediately.</li>
          <li>Permanently terminate the responsible account and any linked accounts.</li>
          <li>
            Preserve the relevant content and account records as required to assist law enforcement, and report
            apparent child sexual abuse material to the National Center for Missing &amp; Exploited Children (NCMEC)
            in accordance with 18 U.S.C. &sect; 2258A.
          </li>
          <li>Cooperate with valid legal process from law enforcement.</li>
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">5. Proactive measures</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          Rabona enforces account-level controls (blocking, account deletion, and message restrictions for
          non-friends) and reviews flagged content. We do not knowingly allow accounts dedicated to the
          sexualization of minors and remove such accounts on detection. We continue to improve our detection and
          response tooling as the service grows.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">6. Child safety point of contact</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          For child safety inquiries, law enforcement requests, or escalations, contact{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent">
            {SUPPORT_EMAIL}
          </a>
          .
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
