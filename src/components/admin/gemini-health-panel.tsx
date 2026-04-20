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

export function GeminiHealthPanel() {
  const api = ((trpcClient as { api?: unknown; trpc?: unknown }).api ??
    (trpcClient as { api?: unknown; trpc?: unknown }).trpc) as {
    adminInsights: {
      getGeminiHealth: {
        useQuery: () => {
          data?: {
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

  const { data, isPending, isError } = api.adminInsights.getGeminiHealth.useQuery()

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
    return <p className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-[#6b6b6b]">No Gemini health data available</p>
  }

  const rate429 = parseNumber(data.rate429Pct24h)
  const errorRate = parseNumber(data.errorRatePct24h)
  const retries = parseNumber(data.avgRetries24h)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <KpiCard label="429 rate (24h)" value={formatPct(rate429)} trend={{ direction: rate429 > 5 ? "down" : "up", percentage: rate429 }} />
      <KpiCard label="Error rate (24h)" value={formatPct(errorRate)} trend={{ direction: errorRate > 5 ? "down" : "up", percentage: errorRate }} />
      <KpiCard label="Avg retries (24h)" value={retries.toFixed(2)} />
    </div>
  )
}
