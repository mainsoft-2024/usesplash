"use client"

import * as trpcClient from "@/lib/trpc/client"

import { KpiCard } from "./kpi-card"

function parseNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`
}

export function RecraftHealthPanel() {
  const api = ((trpcClient as { api?: unknown; trpc?: unknown }).api ??
    (trpcClient as { api?: unknown; trpc?: unknown }).trpc) as {
    adminInsights: {
      getRecraftHealth: {
        useQuery: () => {
          data?: {
            totalAttempts24h?: number | string | null
            rate429Pct24h?: number | string | null
            errorRatePct24h?: number | string | null
            avgRetries24h?: number | string | null
          }
          isPending: boolean
          isError: boolean
        }
      }
    }
  }

  const { data, isPending, isError } = api.adminInsights.getRecraftHealth.useQuery()

  if (isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <article key={idx} className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
            <div className="h-3 w-20 animate-pulse rounded bg-[#2a2a2a]" />
            <div className="mt-3 h-8 w-24 animate-pulse rounded bg-[#2a2a2a]" />
          </article>
        ))}
      </div>
    )
  }

  if (isError) {
    return <p className="rounded-xl border border-[#ef4444]/40 bg-[#7f1d1d]/20 p-4 text-sm text-[#f87171]">Error loading data</p>
  }

  if (!data) {
    return <p className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-[#6b6b6b]">No Recraft health data available</p>
  }

  const totalAttempts = parseNumber(data.totalAttempts24h)
  if (totalAttempts === 0) {
    return (
      <p className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-[#6b6b6b]">
        No vectorize activity
      </p>
    )
  }

  const rate429 = parseNumber(data.rate429Pct24h)
  const errorRate = parseNumber(data.errorRatePct24h)
  const retries = parseNumber(data.avgRetries24h)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <KpiCard label="Vectorize 429 rate (24h)" value={formatPct(rate429)} trend={{ direction: rate429 > 5 ? "down" : "up", percentage: rate429 }} />
      <KpiCard label="Vectorize error rate (24h)" value={formatPct(errorRate)} trend={{ direction: errorRate > 5 ? "down" : "up", percentage: errorRate }} />
      <KpiCard label="Avg vectorize retries (24h)" value={retries.toFixed(2)} />
    </div>
  )
}
