'use client'

import { useState, useEffect, useRef, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowLeft } from 'lucide-react'
import type { Profile } from '@/types'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'

interface Node {
  id: string
  name: string
  avatar: string | null
  x: number
  y: number
  vx: number
  vy: number
  isCenter: boolean
  img?: HTMLImageElement | null
  scale: number
}

export default function NetworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [friends, setFriends] = useState<Profile[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<Node[]>([])
  const animRef = useRef<number>(0)
  const dragRef = useRef<{ node: Node; offsetX: number; offsetY: number; startX: number; startY: number } | null>(null)
  const hoverRef = useRef<Node | null>(null)
  const frameRef = useRef(0)
  const sizeRef = useRef({ w: 0, h: 0 })
  const zoomRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    async function load() {
      const { data: profileData } = await supabase.from('profiles').select(PROFILE_PUBLIC_COLUMNS).eq('id', id).single<Profile>()
      if (profileData) setProfile(profileData)

      // Load friends (accepted friendships in either direction)
      const { data: friendData } = await supabase
        .from('friendships')
        .select(`requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(${PROFILE_PUBLIC_COLUMNS}), addressee:profiles!friendships_addressee_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
        .eq('status', 'accepted')
        .or(`requester_id.eq.${id},addressee_id.eq.${id}`)

      if (friendData) {
        setFriends(friendData.map(f =>
          (f.requester_id === id ? f.addressee : f.requester) as unknown as Profile
        ).filter(p => !p.hidden_from_directory))
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (loading || !profile) return

    const canvas = canvasRef.current
    if (!canvas) return

    const container = canvas.parentElement
    if (!container) return
    const w = container.clientWidth
    const h = container.clientHeight
    sizeRef.current = { w, h }

    const cx = w / 2
    const cy = h / 2

    const nodes: Node[] = [
      { id: profile.id, name: profile.full_name, avatar: profile.avatar_url, x: cx, y: cy, vx: 0, vy: 0, isCenter: true, scale: 0 },
    ]

    const radius = Math.min(w, h) * 0.3
    friends.forEach((f, i) => {
      // Random offset so nodes don't line up perfectly
      const baseAngle = (2 * Math.PI * i) / friends.length
      const jitter = (Math.random() - 0.5) * 0.8
      const angle = baseAngle + jitter
      const rJitter = radius * (0.7 + Math.random() * 0.5)
      nodes.push({
        id: f.id,
        name: f.full_name,
        avatar: f.avatar_url,
        x: cx + rJitter * Math.cos(angle),
        y: cy + rJitter * Math.sin(angle),
        vx: 0,
        vy: 0,
        isCenter: false,
        scale: 0,
      })
    })

    // Load images
    nodes.forEach(n => {
      if (n.avatar) {
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.src = n.avatar
        n.img = img
      }
    })

    // Set all scales to 1 immediately
    nodes.forEach(n => { n.scale = 1 })
    nodesRef.current = nodes
    frameRef.current = 0

    function tick() {
      // Only redraw when dragging
      draw()
      animRef.current = requestAnimationFrame(tick)
    }

    function draw() {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { w, h } = sizeRef.current
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)

      const zoom = zoomRef.current
      const pan = panRef.current
      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)

      const nodes = nodesRef.current
      const centerNode = nodes[0]
      const hover = hoverRef.current

      // Edges
      for (let i = 1; i < nodes.length; i++) {
        const n = nodes[i]
        if (n.scale < 0.05) continue
        const grad = ctx.createLinearGradient(centerNode.x, centerNode.y, n.x, n.y)
        const alpha = hover === n ? 0.5 : 0.25
        grad.addColorStop(0, `rgba(255,255,255,${alpha * n.scale})`)
        grad.addColorStop(1, `rgba(255,255,255,${alpha * 0.4 * n.scale})`)
        ctx.beginPath()
        ctx.moveTo(centerNode.x, centerNode.y)
        ctx.lineTo(n.x, n.y)
        ctx.strokeStyle = grad
        ctx.lineWidth = hover === n ? 2.5 : 1.5
        ctx.stroke()
      }

      // Nodes — friends first, center on top
      const sorted = [...nodes].sort((a, b) => (a.isCenter ? 1 : 0) - (b.isCenter ? 1 : 0))

      for (const n of sorted) {
        if (n.scale < 0.01) continue
        const baseR = n.isCenter ? 38 : 26
        const isHovered = hover === n
        const r = baseR * n.scale * (isHovered ? 1.08 : 1)

        // Glow
        if ((n.isCenter || isHovered) && n.scale > 0.3) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, r + 10, 0, Math.PI * 2)
          const glow = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r + 10)
          glow.addColorStop(0, `rgba(255,255,255,${n.isCenter ? 0.15 : 0.1})`)
          glow.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = glow
          ctx.fill()
        }

        // Avatar
        ctx.save()
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()
        if (n.img && n.img.complete && n.img.naturalWidth > 0) {
          ctx.drawImage(n.img, n.x - r, n.y - r, r * 2, r * 2)
        } else {
          ctx.fillStyle = '#222'
          ctx.fillRect(n.x - r, n.y - r, r * 2, r * 2)
          ctx.fillStyle = '#999'
          ctx.font = `bold ${r * 0.7}px "DM Sans", sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(n.name?.charAt(0)?.toUpperCase() || '?', n.x, n.y)
        }
        ctx.restore()

        // Ring
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.strokeStyle = n.isCenter ? 'rgba(255,255,255,0.7)' : isHovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)'
        ctx.lineWidth = n.isCenter ? 3 : 2
        ctx.stroke()

        // Label
        const labelY = n.y + r + (n.isCenter ? 18 : 14)
        ctx.font = `${n.isCenter ? 600 : 500} ${n.isCenter ? 14 : 11}px "DM Sans", sans-serif`
        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillText(n.name?.split(' ')[0] || '', n.x + 1, labelY + 1)
        ctx.fillStyle = n.isCenter ? '#fff' : isHovered ? '#fff' : 'rgba(255,255,255,0.85)'
        ctx.fillText(n.name?.split(' ')[0] || '', n.x, labelY)

        if (n.isCenter && n.scale > 0.8) {
          const last = n.name?.split(' ').slice(1).join(' ')
          if (last) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)'
            ctx.font = '400 10px "DM Sans", sans-serif'
            ctx.fillText(last, n.x, labelY + 14)
          }
        }
      }

      ctx.restore()
    }

    // Wheel zoom
    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const oldZoom = zoomRef.current
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.3, Math.min(3, oldZoom * delta))
      // Zoom toward mouse position
      panRef.current.x = mouseX - (mouseX - panRef.current.x) * (newZoom / oldZoom)
      panRef.current.y = mouseY - (mouseY - panRef.current.y) * (newZoom / oldZoom)
      zoomRef.current = newZoom
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    animRef.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(animRef.current); canvas.removeEventListener('wheel', handleWheel) }
  }, [loading, profile, friends])

  function screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - panRef.current.x) / zoomRef.current,
      y: (sy - panRef.current.y) / zoomRef.current,
    }
  }

  function getNodeAt(sx: number, sy: number): Node | null {
    const { x, y } = screenToWorld(sx, sy)
    for (const n of [...nodesRef.current].reverse()) {
      const r = (n.isCenter ? 38 : 26) * n.scale
      const dx = x - n.x
      const dy = y - n.y
      if (dx * dx + dy * dy <= (r + 8) * (r + 8)) return n
    }
    return null
  }

  const panDragRef = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null)

  function handlePointerDown(e: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const node = getNodeAt(sx, sy)
    if (node) {
      const { x, y } = screenToWorld(sx, sy)
      dragRef.current = { node, offsetX: x - node.x, offsetY: y - node.y, startX: sx, startY: sy }
    } else {
      // Pan the canvas
      panDragRef.current = { startX: e.clientX, startY: e.clientY, origPanX: panRef.current.x, origPanY: panRef.current.y }
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    if (dragRef.current) {
      const { x, y } = screenToWorld(sx, sy)
      dragRef.current.node.x = x - dragRef.current.offsetX
      dragRef.current.node.y = y - dragRef.current.offsetY
      dragRef.current.node.vx = 0
      dragRef.current.node.vy = 0
    } else if (panDragRef.current) {
      panRef.current.x = panDragRef.current.origPanX + (e.clientX - panDragRef.current.startX)
      panRef.current.y = panDragRef.current.origPanY + (e.clientY - panDragRef.current.startY)
    }
    const node = getNodeAt(sx, sy)
    hoverRef.current = node
    if (canvasRef.current) canvasRef.current.style.cursor = dragRef.current ? 'grabbing' : panDragRef.current ? 'grabbing' : node ? 'pointer' : 'grab'
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const dx = (e.clientX - rect.left) - dragRef.current.startX
        const dy = (e.clientY - rect.top) - dragRef.current.startY
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
          router.push(`/profile/${dragRef.current.node.id}`)
        }
      }
      dragRef.current = null
    }
    panDragRef.current = null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-6 text-center">
        <p className="text-text-muted">User not found.</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#111] flex flex-col" style={{ bottom: '56px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#111] border-b border-white/10 flex-shrink-0">
        <button onClick={() => router.back()} className="press text-white/50 hover:text-white p-1">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-white text-[15px] font-bold">{profile.full_name}&apos;s Network</h1>
          <p className="text-white/30 text-[11px]">{friends.length} friend{friends.length !== 1 ? 's' : ''} &middot; drag to pan &middot; scroll to zoom &middot; tap to visit</p>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none cursor-grab"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => { hoverRef.current = null }}
        />
      </div>
    </div>
  )
}
