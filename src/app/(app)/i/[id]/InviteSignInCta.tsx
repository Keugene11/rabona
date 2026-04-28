'use client'

import { useSignIn } from '@/components/SignInModal'

export default function InviteSignInCta({ inviterFirstName }: { inviterFirstName: string }) {
  const { open } = useSignIn()
  return (
    <div className="bg-bg-card border border-border rounded-2xl p-5">
      <h2 className="text-[18px] font-bold">{inviterFirstName} invited you to Rabona</h2>
      <p className="text-[13px] text-text-muted mt-1">
        Sign up and you&apos;ll be friends right away.
      </p>
      <button
        type="button"
        onClick={open}
        className="press w-full bg-accent text-white text-center font-semibold text-[14px] py-3 rounded-xl mt-4"
      >
        Sign up to join
      </button>
    </div>
  )
}
