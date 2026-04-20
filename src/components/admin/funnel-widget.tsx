"use client"

import * as trpcClient from "@/lib/trpc/client"

type Period = "7" | "30" | "90" | "all"

function parseNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

interface FunnelWidgetProps {
  period: Period
}

export function FunnelWidget({ period }: FunnelWidgetProps) {
  const api = ((trpcClient as { api?: unknown; trpc?: unknown }).api ??
    (trpcClient as { api?: unknown; trpc?: unknown }).trpc) as {
    adminInsights: {
      getFunnel: {
        useQuery: (input: { period: Period }) => {
          data?: {
            signups?: number | string | null
            firstProject?: number | string | null
            firstGeneration?: number | string | null
            paidSub?: number | string | null
          }
          isPending: boolean
          isError: boolean
        }
      }
    }
  }

  const { data, isPending, isError } = api.adminInsights.getFunnel.useQuery({ period })

  if (isPending) {
    return <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-[#a1a1a1]">Loading funnel...</div>
  }

  if (isError) {
    return <p className="rounded-xl border border-[#ef4444]/40 bg-[#7f1d1d]/20 p-4 text-sm text-[#f87171]">Error loading data</p>
  }

  if (!data) {
    return <p className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-[#6b6b6b]">No funnel data available</p>
  }

  const signups = Math.max(0, parseNumber(data.signups))
  const stages = [
    { label: "Signups", value: signups },
    { label: "First project", value: Math.max(0, parseNumber(data.firstProject)) },
    { label: "First generation", value: Math.max(0, parseNumber(data.firstGeneration)) },
    { label: "Paid sub", value: Math.max(0, parseNumber(data.paidSub)) },
  ]

  return (
    <article className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <p className="text-xs uppercase tracking-wider text-[#a1a1a1]">Funnel</p>
      <div className="mt-4 space-y-3">
        {stages.map((stage, idx) => {
          const ratio = signups > 0 ? Math.max(0, Math.min(100, (stage.value / signups) * 100)) : 0
          const width = `${Math.max(12, ratio)}%`
          return (
            <div key={stage.label}>
              <div className="mb-1 flex items-center justify-between text-xs [font-variant-numeric:tabular-nums]">
                <span className="text-[#a1a1a1]">{stage.label}</span>
                <span className="text-white">
                  {stage.value.toLocaleString()} · {ratio.toFixed(1)}%
                </span>
              </div>
              <div className="h-7 rounded border border-[#2a2a2a] bg-[#111111] p-0.5">
                <div
                  className={idx === stages.length - 1 ? "h-full rounded bg-[#f59e0b]" : "h-full rounded bg-[var(--accent-green)]"}
                  style={{ width }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}
