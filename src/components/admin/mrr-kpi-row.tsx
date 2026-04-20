"use client"

import { trpc } from "../../lib/trpc/client"

type Period = "7" | "30" | "90" | "all"

type MrrKpiRowProps = {
  period: Period
}

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

export function MrrKpiRow({ period }: MrrKpiRowProps) {
  const { data, isLoading, error } = trpc.adminInsights.getMrrBreakdown.useQuery({ period })

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <div className="grid gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="rounded-lg border border-[#2a2a2a] bg-[#1f1f1f] p-4">
              <div className="h-3 w-16 animate-pulse rounded bg-[#2a2a2a]" />
              <div className="mt-3 h-7 w-24 animate-pulse rounded bg-[#2a2a2a]" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-red-500">Error loading MRR KPIs</div>
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-[#a1a1a1]">
        No revenue data available
      </div>
    )
  }

  const momValue = data.mrrGrowthPct == null ? "—" : `${data.mrrGrowthPct >= 0 ? "↑" : "↓"} ${formatPercent(Math.abs(data.mrrGrowthPct))}`
  const momClass = data.mrrGrowthPct == null ? "text-[#a1a1a1]" : data.mrrGrowthPct >= 0 ? "text-[var(--accent-green)]" : "text-[#ef4444]"

  const cards = [
    { label: "MRR", value: formatUsd(data.mrrThisMonth) },
    { label: "MoM", value: momValue, valueClass: momClass },
    { label: "ARR", value: formatUsd(data.arr) },
    { label: "Paid Subs", value: data.paidSubCount.toLocaleString("en-US") },
    { label: "Weekly Churn", value: formatPercent(data.weeklyChurnPct) },
  ]

  return (
    <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <header className="mb-4">
        <h3 className="text-xs uppercase tracking-wider text-[#a1a1a1]">MRR Snapshot</h3>
      </header>
      <div className="grid gap-4 md:grid-cols-5">
        {cards.map((card) => (
          <article key={card.label} className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
            <p className="text-xs uppercase tracking-wider text-[#a1a1a1]">{card.label}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight text-white [font-variant-numeric:tabular-nums] ${card.valueClass ?? ""}`}>
              {card.value}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
