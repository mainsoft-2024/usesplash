"use client"

import { useRef, useState } from "react"
import data from "@/lib/logo-evolution.json"

const SPLASH = data.sequences.find((s) => s.id === "splash")!
const V17 = SPLASH.versions.find((v) => v.originalN === 17)!.url
const V20 = SPLASH.versions.find((v) => v.originalN === 20)!.url
const SPOT_RADIUS = 64 // px

export function HeaderLogo() {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const mask = pos
    ? `radial-gradient(circle ${SPOT_RADIUS}px at ${pos.x}px ${pos.y}px, black 0%, black 55%, transparent 100%)`
    : undefined

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setPos(null)}
      className="relative inline-block h-9 w-16 overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-black/5"
      aria-label="Splash"
    >
      {/* base: v17 */}
      <img
        src={V17}
        alt="Splash"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {/* hover overlay: v20 revealed inside the spotlight */}
      <img
        src={V20}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-out"
        style={{
          opacity: pos ? 1 : 0,
          WebkitMaskImage: mask,
          maskImage: mask,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
        }}
        draggable={false}
      />
    </div>
  )
}
