import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Profile, WallPost } from '@/types'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'
import MentionText from '@/components/MentionText'
import InviteSignInCta from './InviteSignInCta'

export const dynamic = 'force-dynamic'

export default async function InvitePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const inviterFirstName = (from || '').slice(0, 40) || 'A friend'

  // Service role: signed-out visitors can't read profiles/wall_posts via RLS,
  // and we only render public columns server-side, so this stays safe.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await admin
    .from('profiles')
    .select(PROFILE_PUBLIC_COLUMNS)
    .eq('id', id)
    .maybeSingle<Profile>()

  if (!profile || profile.hidden_from_directory) notFound()

  // Respect the inviter's wall_posts_from preference: if they've locked their
  // wall to friends only, don't render posts to a stranger via the preview.
  const wallIsPublic =
    !profile.wall_posts_from || profile.wall_posts_from === 'everyone'

  let posts: WallPost[] = []
  if (wallIsPublic) {
    const { data } = await admin
      .from('wall_posts')
      .select(`*, author:profiles!wall_posts_author_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .eq('wall_owner_id', id)
      .eq('author_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
    posts = (data || []) as WallPost[]
  }

  const initial = profile.full_name?.charAt(0)?.toUpperCase() || '?'

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-28">
      <InviteSignInCta inviterFirstName={inviterFirstName} />

      <div className="flex items-center gap-3.5 mb-4 mt-4">
        <div className="w-16 h-16 rounded-full bg-bg-input border-2 border-border overflow-hidden flex-shrink-0">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[24px] font-bold text-text-muted">
              {initial}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-bold tracking-tight truncate">{profile.full_name}</h1>
          {profile.username && (
            <p className="text-[13px] text-text-muted truncate">@{profile.username}</p>
          )}
        </div>
      </div>

      {profile.about_me && (
        <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 mb-4">
          <p className="text-[14px]">{profile.about_me}</p>
        </div>
      )}

      {!wallIsPublic ? (
        <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-text-muted text-[14px]">
            {profile.full_name?.split(' ')[0] || 'They'} keep their wall private. Sign up to send a friend request.
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-text-muted text-[14px]">No wall posts yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PreviewPost key={post.id} post={post} />
          ))}
        </div>
      )}

      <p className="text-[12px] text-text-muted mt-6 text-center">
        <Link href="/about" className="text-accent press">Learn more about Rabona</Link>
      </p>
    </div>
  )
}

function PreviewPost({ post }: { post: WallPost }) {
  const author = post.author
  const initial = author?.full_name?.charAt(0)?.toUpperCase() || '?'
  return (
    <article className="bg-bg-card border border-border rounded-2xl px-4 py-3.5">
      <header className="flex items-center gap-2.5 mb-2">
        <div className="w-9 h-9 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
          {author?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[13px] font-bold text-text-muted">
              {initial}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold truncate">{author?.full_name}</p>
          <p className="text-[12px] text-text-muted">{formatDate(post.created_at)}</p>
        </div>
      </header>
      <MentionText
        text={post.content}
        className="text-[15px] whitespace-pre-wrap break-words"
      />
      {post.media_url && (
        <div className="mt-3 rounded-xl overflow-hidden border border-border">
          {/\.(mp4|webm|mov|avi)$/i.test(post.media_url) ? (
            <video src={post.media_url} controls className="w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.media_url} alt="" className="w-full" />
          )}
        </div>
      )}
    </article>
  )
}

function formatDate(s: string) {
  const d = new Date(s)
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
