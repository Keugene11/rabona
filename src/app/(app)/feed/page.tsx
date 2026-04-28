'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import type { WallPost } from '@/types'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'
import WallPostItem from '@/components/WallPost'
import WallPostForm from '@/components/WallPostForm'
import InviteLinkCard from '@/components/InviteLinkCard'
import { readPendingPost, clearPendingPost } from '@/lib/pending-post'
import { notifyFriends } from '@/lib/notifyFriends'
import { notifyMentions } from '@/components/MentionAutocomplete'


export default function FeedPage() {
  const supabase = createClient()
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [friendIds, setFriendIds] = useState<string[]>([])
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [hasMore, setHasMore] = useState(true)
  const [username, setUsername] = useState('')
  const PAGE_SIZE = 20

  useEffect(() => {
    loadFeed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadFeed() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setPosts([])
      setHasMore(false)
      setLoading(false)
      return
    }
    setCurrentUserId(user.id)

    // If they came back from login with a draft we stashed before sign-in,
    // submit it now so the post lands on their wall.
    const pending = readPendingPost()
    if (pending && pending.content.trim()) {
      const { data } = await supabase
        .from('wall_posts')
        .insert({
          author_id: user.id,
          wall_owner_id: user.id,
          content: pending.content.trim(),
          media_url: null,
        })
        .select(`*, author:profiles!wall_posts_author_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
        .single()
      clearPendingPost()
      if (data) {
        setPosts(prev => [data as WallPost, ...prev])
        const mentionedIds = await notifyMentions(supabase, user.id, pending.content, {
          post_type: 'wall_post',
          post_id: (data as WallPost).id,
        })
        notifyFriends(supabase, user.id, 'friend_post', {
          post_type: 'wall_post',
          post_id: (data as WallPost).id,
          content: pending.content.slice(0, 100),
        }, mentionedIds)
      }
    }

    // Grab the username so we can render the invite link.
    supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.username) setUsername(data.username) })

    // Get friends for the isFriend prop on posts
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    const fIds = (friendships || []).map(f =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    )
    setFriendIds(fIds)

    // Get blocked users to filter out
    const { data: blocks } = await supabase
      .from('blocks')
      .select('blocked_id, blocker_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)

    const bIds = new Set<string>()
    for (const b of blocks || []) {
      if (b.blocker_id === user.id) bIds.add(b.blocked_id)
      else bIds.add(b.blocker_id)
    }
    setBlockedIds(bIds)

    // Feed = posts authored by you or your friends, on their own wall.
    const visibleAuthors = [user.id, ...fIds]
    if (visibleAuthors.length === 0) {
      setPosts([])
      setHasMore(false)
      setLoading(false)
      return
    }
    const { data: postData } = await supabase
      .from('wall_posts')
      .select(`*, author:profiles!wall_posts_author_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .in('author_id', visibleAuthors)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE * 2)

    if (postData) {
      const ownWallPosts = (postData as WallPost[]).filter(p => p.author_id === p.wall_owner_id && !bIds.has(p.author_id)).slice(0, PAGE_SIZE)
      setPosts(ownWallPosts)
      setHasMore(ownWallPosts.length === PAGE_SIZE)
    }

    setLoading(false)
  }

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || posts.length === 0) return
    setLoadingMore(true)

    const lastPost = posts[posts.length - 1]
    const visibleAuthors = [currentUserId, ...friendIds]

    const { data: postData } = await supabase
      .from('wall_posts')
      .select(`*, author:profiles!wall_posts_author_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .in('author_id', visibleAuthors)
      .lt('created_at', lastPost.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE * 2)

    if (postData) {
      const ownWallPosts = (postData as WallPost[]).filter(p =>
        p.author_id === p.wall_owner_id && !blockedIds.has(p.author_id)
      ).slice(0, PAGE_SIZE)
      setPosts(prev => [...prev, ...ownWallPosts])
      setHasMore(ownWallPosts.length === PAGE_SIZE)
    }

    setLoadingMore(false)
  }, [loadingMore, hasMore, posts, blockedIds, currentUserId, friendIds, supabase])

  // Infinite scroll
  useEffect(() => {
    function handleScroll() {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        loadMore()
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loadMore])

  function handleNewPost(post: WallPost) {
    setPosts(prev => [post, ...prev])
  }

  function handleDeletePost(postId: string) {
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  const signedIn = !!currentUserId

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-28">
      <div className="mb-4 lg:hidden">
        <h1 className="text-[24px] font-extrabold tracking-tight">[ Rabona ]</h1>
        <div className="accent-bar" />
      </div>

      {!signedIn && (
        <div className="bg-bg-card border border-border rounded-2xl p-5 mb-4">
          <h2 className="text-[18px] font-bold">Welcome to Rabona</h2>
          <p className="text-[13px] text-text-muted mt-1">Sign in to post, like, and connect with friends.</p>
          <div className="flex gap-2 mt-4">
            <Link
              href="/login?returnTo=/feed"
              className="press flex-1 bg-accent text-white text-center font-semibold text-[14px] py-3 rounded-xl"
            >
              Sign in to post
            </Link>
            <Link
              href="/login?returnTo=/feed"
              className="press flex-1 bg-bg-input border border-border text-text text-center font-semibold text-[14px] py-3 rounded-xl"
            >
              Invite friends
            </Link>
          </div>
        </div>
      )}

      {signedIn && <InviteLinkCard username={username} className="mb-4" />}

      {/* Compose — works for anonymous too; submitting routes through login. */}
      <div className="mb-4">
        <WallPostForm wallOwnerId={currentUserId} onPost={handleNewPost} />
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-[14px] text-text-muted">
            {!signedIn
              ? 'Sign in to see posts from your friends.'
              : friendIds.length === 0
                ? 'No friends yet. Share your invite link from your profile to get started.'
                : 'No posts yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <WallPostItem
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              wallOwnerId={post.wall_owner_id}
              onDelete={handleDeletePost}
              isFriend={friendIds.includes(post.author_id)}
              truncate
            />
          ))}

          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-text-muted" size={20} />
            </div>
          )}

          {!hasMore && posts.length > 0 && (
            <p className="text-center text-[12px] text-text-muted py-4">You&apos;re all caught up!</p>
          )}
        </div>
      )}
    </div>
  )
}
