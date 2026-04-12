import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 pt-16 pb-20">
      <div className="text-center mb-12">
        <h1 className="text-[32px] font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="text-[14px] text-text-muted mt-2">Last updated: April 6, 2026</p>
      </div>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">1. Information We Collect</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          When you sign in with Google, we receive your name, email address, and profile picture. You may also provide additional information such as your major, class year, dorm, clubs, and hometown. We collect content you post, including wall posts, comments, messages, and uploaded photos and videos.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">2. How We Use Your Information</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          We use your information to provide and improve Rabona, including displaying your profile to other students, enabling social features like friends, messaging, and groups, and sending you notifications about activity on your account.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">3. Information Sharing</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          Your profile information is visible to other Rabona users according to your privacy settings. We do not sell your personal information to third parties. We do not share your information with third parties except as required by law.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">4. Data Storage</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          Your data is stored securely using Supabase, hosted on servers in the United States. We use industry-standard security measures to protect your information.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">5. Your Rights</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          You can edit or delete your profile information at any time through the settings page. You can delete your account entirely, which will permanently remove all your data including posts, comments, messages, and friend connections.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">6. Cookies</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          We use cookies to keep you signed in and maintain your session. These are essential cookies required for the service to function.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">7. Eligibility</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          Rabona is available to anyone with a Google account.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">8. Changes to This Policy</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          We may update this privacy policy from time to time. We will notify users of any significant changes through the platform.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-[18px] font-bold mb-2">9. Contact</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          If you have questions about this privacy policy, contact us at{' '}
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
