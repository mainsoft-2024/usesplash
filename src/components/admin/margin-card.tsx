"use client"

import * as trpcClient from "@/lib/trpc/client"

type Period = "7" | "30" | "90" | "all"

function parseNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

interface MarginCardProps {
  period: Period
}

export function MarginCard({ period }: MarginCardProps) {
  const api = ((trpcClient as { api?: unknown; trpc?: unknown }).api ??
    (trpcClient as { api?: unknown; trpc?: unknown }).trpc) as {
    adminInsights: {
      getOverviewKpis: {
        useQuery: (input: { period: Period }) => {
          data?: {
            marginUsd?: number | string | null
            marginPct?: number | string | null
            burnRate30d?: number | string | null
          }
          isPending: boolean
          isError: boolean
        }
      }
    }
  }

  const { data, isPending, isError } = api.adminInsights.getOverviewKpis.useQuery({ period })

  if (isPending) {
    return (
      <article className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <div className="h-3 w-28 animate-pulse rounded bg-[#2a2a2a]" />
        <div className="mt-4 h-7 w-32 animate-pulse rounded bg-[#2a2a2a]" />
        <div className="mt-4 h-2 w-full animate-pulse rounded bg-[#2a2a2a]" />
      </article>
    )
  }

  if (isError) {
    return <p className="rounded-xl border border-[#ef4444]/40 bg-[#7f1d1d]/20 p-4 text-sm text-[#f87171]">Error loading data</p>
  }

  if (!data) {
    return <p className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-[#6b6b6b]">No margin data available</p>
  }

  const marginPct = Math.max(0, Math.min(100, parseNumber(data.marginPct)))
  const burn = parseNumber(data.burnRate30d)
  const marginUsd = parseNumber(data.marginUsd)
  const barColor = marginPct < 70 ? "bg-[#f59e0b]" : "bg-[var(--accent-green)]"

  return (
    <article className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <p className="text-xs uppercase tracking-wider text-[#a1a1a1]">Margin & Burn</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white [font-variant-numeric:tabular-nums]">
        {formatCurrency(marginUsd)}
      </p>
      <div className="mt-4 h-2 w-full overflow-hidden rounded bg-[#2a2a2a]">
        <div className={`h-full ${barColor}`} style={{ width: `${marginPct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs [font-variant-numeric:tabular-nums]">
        <span className="text-[#a1a1a1]">Gross margin</span>
        <span className="text-white">{marginPct.toFixed(1)}%</span>
      </div>
      <div className="mt-3 text-xs [font-variant-numeric:tabular-nums]">
        <span className="text-[#a1a1a1]">Burn rate (30d): </span>
        <span className={burn > 0 ? "text-[#ef4444]" : "text-white"}>{formatCurrency(burn)}</span>
      </div>
    </article>
  )
}
