'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, ZoomIn, ZoomOut, Check } from 'lucide-react'

interface AvatarCropperProps {
  file: File
  onSave: (blob: Blob) => void
  onCancel: () => void
}

export default function AvatarCropper({ file, onSave, onCancel }: AvatarCropperProps) {
  const [imgSrc] = useState(() => URL.createObjectURL(file))
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [cropSize, setCropSize] = useState(300)

  useEffect(() => {
    const img = new window.Image()
    img.onload = () => setImgNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = imgSrc
    return () => URL.revokeObjectURL(imgSrc)
  }, [imgSrc])

  // Size the crop area to fit available space
  useEffect(() => {
    function updateSize() {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const s = Math.min(rect.width - 32, rect.height - 32, 400)
      setCropSize(Math.max(200, s))
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const baseScale = imgNatural.w > 0 ? Math.max(cropSize / imgNatural.w, cropSize / imgNatural.h) : 1

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    setOffset({
      x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
    })
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function handleSave() {
    const img = imgRef.current
    if (!img) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const outSize = 512
    canvas.width = outSize
    canvas.height = outSize
    const s = outSize / cropSize
    const totalScale = baseScale * zoom
    const drawW = imgNatural.w * totalScale * s
    const drawH = imgNatural.h * totalScale * s
    const drawX = (outSize - drawW) / 2 + offset.x * s
    const drawY = (outSize - drawH) / 2 + offset.y * s
    ctx.drawImage(img, drawX, drawY, drawW, drawH)
    canvas.toBlob((blob) => { if (blob) onSave(blob) }, 'image/jpeg', 0.9)
  }

  const dispW = imgNatural.w * baseScale * zoom
  const dispH = imgNatural.h * baseScale * zoom

  return (
    <div className="fixed inset-0 bg-bg z-[60] flex flex-col" style={{ height: '100dvh', overscrollBehavior: 'none' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
        <button onClick={onCancel} className="press text-text-muted">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-[17px] font-bold">Adjust Photo</h3>
        <button onClick={handleSave} className="press text-[14px] font-semibold text-accent flex items-center gap-1.5">
          <Check size={16} /> Save
        </button>
      </div>

      {/* Crop area — fills available space */}
      <div ref={containerRef} className="flex-1 min-h-0 flex items-center justify-center bg-black/5">
        <div
          className="relative rounded-xl overflow-hidden border border-border cursor-grab active:cursor-grabbing bg-bg-input"
          style={{ width: cropSize, height: cropSize, touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {imgNatural.w > 0 && (
            <img
              ref={imgRef}
              src={imgSrc}
              alt=""
              draggable={false}
              className="absolute select-none pointer-events-none"
              style={{
                width: dispW,
                height: dispH,
                left: (cropSize - dispW) / 2 + offset.x,
                top: (cropSize - dispH) / 2 + offset.y,
              }}
            />
          )}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center justify-center gap-3 px-4 py-5 border-t border-border flex-shrink-0">
        <ZoomOut size={18} className="text-text-muted" />
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.05"
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="w-56 accent-accent"
        />
        <ZoomIn size={18} className="text-text-muted" />
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
