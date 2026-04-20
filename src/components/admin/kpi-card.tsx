import type { ReactNode } from "react"

type TrendDirection = "up" | "down"

export interface KpiCardProps {
  label: string
  value: string | number
  trend?: {
    direction: TrendDirection
    percentage: number
  }
  sparkline?: number[]
  footer?: ReactNode
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return null
  }

  const width = 96
  const height = 24
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const normalized = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-6 w-24" role="img" aria-label="KPI trend sparkline">
      <polyline fill="none" stroke="var(--accent-green)" strokeWidth="2" points={normalized} />
    </svg>
  )
}

export function KpiCard({ label, value, trend, sparkline, footer }: KpiCardProps) {
  const trendClass = trend?.direction === "up" ? "text-[var(--accent-green)]" : "text-[#ef4444]"

  return (
    <article className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
      <p className="text-xs uppercase tracking-wider text-[#a1a1a1]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-white [font-variant-numeric:tabular-nums]">{value}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        {trend ? (
          <p className={`text-xs [font-variant-numeric:tabular-nums] ${trendClass}`}>
            {trend.direction === "up" ? "↑" : "↓"} {trend.percentage.toFixed(1)}%
          </p>
        ) : (
          <span />
        )}
        {sparkline ? <Sparkline points={sparkline} /> : null}
      </div>
      {footer ? <div className="mt-3 text-xs text-[#a1a1a1]">{footer}</div> : null}
    </article>
  )
}
