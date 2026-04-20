"use client"

import * as trpcClient from "@/lib/trpc/client"

import { KpiCard } from "./kpi-card"

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

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

interface OverviewKpisProps {
  period: Period
}

export function OverviewKpis({ period }: OverviewKpisProps) {
  const api = ((trpcClient as { api?: unknown; trpc?: unknown }).api ??
    (trpcClient as { api?: unknown; trpc?: unknown }).trpc) as {
    adminInsights: {
      getOverviewKpis: {
        useQuery: (input: { period: Period }) => {
          data?: {
            mrrThisMonth?: number | string | null
            totalUsers?: number | string | null
            activeUsers?: number | string | null
            generationsInPeriod?: number | string | null
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
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
    return <p className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-[#6b6b6b]">No overview data available</p>
  }

  const mrr = parseNumber(data.mrrThisMonth)
  const activeUsers = parseNumber(data.activeUsers)
  const generations = parseNumber(data.generationsInPeriod)
  const marginUsd = parseNumber(data.marginUsd)
  const marginPct = parseNumber(data.marginPct)
  const burn = parseNumber(data.burnRate30d)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard label="MRR" value={formatCurrency(mrr)} />
      <KpiCard label="Active users" value={formatCompact(activeUsers)} footer={`전체 ${formatCompact(parseNumber(data.totalUsers))}`} />
      <KpiCard label="Generations" value={formatCompact(generations)} />
      <KpiCard
        label="Margin"
        value={formatCurrency(marginUsd)}
        trend={{ direction: marginPct >= 0 ? "up" : "down", percentage: Math.abs(marginPct) }}
      />
      <KpiCard label="Burn (30d)" value={formatCurrency(burn)} trend={{ direction: "down", percentage: 0 }} />
    </div>
  )
}
