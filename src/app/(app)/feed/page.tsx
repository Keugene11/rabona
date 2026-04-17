'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import type { WallPost } from '@/types'
import WallPostItem from '@/components/WallPost'
import WallPostForm from '@/components/WallPostForm'

export default function FeedPage() {
  const supabase = createClient()
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [followedIds, setFollowedIds] = useState<string[]>([])
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 20

  useEffect(() => {
    loadFeed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadFeed() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    // Get friends (accepted friendships in either direction)
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    const fIds = (friendships || []).map(f =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    )
    setFollowedIds(fIds)

    // Get blocked users to filter out
    const { data: blocks } = await supabase
      .from('blocks')
      .select('blocked_id, blocker_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)

    const blockedIds = new Set<string>()
    for (const b of blocks || []) {
      if (b.blocker_id === user.id) blockedIds.add(b.blocked_id)
      else blockedIds.add(b.blocker_id)
    }

    // Feed authors = friends + myself, minus blocked
    const feedAuthors = [user.id, ...fIds].filter(id => !blockedIds.has(id))

    if (feedAuthors.length === 0) {
      setLoading(false)
      return
    }

    // Load wall posts from feed authors (only posts on their own wall)
    const { data: postData } = await supabase
      .from('wall_posts')
      .select('*, author:profiles!wall_posts_author_id_fkey(*)')
      .in('author_id', feedAuthors)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE * 2)

    if (postData) {
      const ownWallPosts = (postData as WallPost[]).filter(p => p.author_id === p.wall_owner_id).slice(0, PAGE_SIZE)
      setPosts(ownWallPosts)
      setHasMore(ownWallPosts.length === PAGE_SIZE)
    }

    setLoading(false)
  }

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || posts.length === 0) return
    setLoadingMore(true)

    const lastPost = posts[posts.length - 1]
    const feedAuthors = [currentUserId, ...followedIds]

    const { data: postData } = await supabase
      .from('wall_posts')
      .select('*, author:profiles!wall_posts_author_id_fkey(*)')
      .in('author_id', feedAuthors)
      .lt('created_at', lastPost.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE * 2)

    if (postData) {
      const ownWallPosts = (postData as WallPost[]).filter(p => p.author_id === p.wall_owner_id).slice(0, PAGE_SIZE)
      setPosts(prev => [...prev, ...ownWallPosts])
      setHasMore(ownWallPosts.length === PAGE_SIZE)
    }

    setLoadingMore(false)
  }, [loadingMore, hasMore, posts, currentUserId, followedIds, supabase])

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

  return (
    <div className="max-w-lg mx-auto px-4 pt-12 pb-28">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold tracking-tight">Feed</h1>
        <div className="accent-bar" />
      </div>

      {/* Compose */}
      <div className="mb-4">
        <WallPostForm wallOwnerId={currentUserId} onPost={handleNewPost} />
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-[14px] text-text-muted">No posts yet. Add friends to see their posts here!</p>
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
              isFriend={followedIds.includes(post.author_id)}
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
