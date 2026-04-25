import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Stale or malformed auth cookie. Treat as logged out — middleware will
    // also clear the bad cookies on the next request.
  }

  if (user) {
    redirect('/feed')
  } else {
    redirect('/login')
  }
}
