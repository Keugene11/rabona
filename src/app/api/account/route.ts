import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let confirmEmail: string | undefined
  try {
    const body = await request.json()
    confirmEmail = typeof body?.confirm_email === 'string' ? body.confirm_email : undefined
  } catch {
    return NextResponse.json({ error: 'Missing confirm_email in request body' }, { status: 400 })
  }

  if (!confirmEmail || confirmEmail.trim().toLowerCase() !== (user.email || '').toLowerCase()) {
    return NextResponse.json({ error: 'Confirmation email does not match your account' }, { status: 400 })
  }

  // All user-owned rows CASCADE-delete from profiles(id) → auth.users(id), so
  // deleting the auth user is sufficient. Explicit .delete() calls were removed
  // as they added no safety and blocked future tables from being covered.
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error } = await adminClient.auth.admin.deleteUser(user.id)

  if (error) {
    // Includes the case where the user is a protected owner (trigger raises).
    return NextResponse.json({ error: error.message || 'Failed to delete account' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
