"use client"

import { useMemo } from "react"
import dynamic from "next/dynamic"
import { trpc } from "../../lib/trpc/client"

type Period = "7" | "30" | "90" | "all"

type MrrTrendChartProps = {
  period: Period
}

type MrrTrendPoint = {
  label: string
  mrr: number
}

const RechartsMrrTrendChart = dynamic(
  async () => {
    const { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } = await import("recharts")

    return function RechartsMrrTrendChartInner({
      data,
    }: {
      data: MrrTrendPoint[]
    }) {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: "#a1a1a1", fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fill: "#a1a1a1", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(value: number) => `$${value.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                borderColor: "#2a2a2a",
                borderRadius: "0.5rem",
                color: "#ffffff",
              }}
              formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "MRR"]}
            />
            <Line type="monotone" dataKey="mrr" stroke="var(--accent-green)" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      )
    }
  },
  {
    ssr: false,
    loading: () => <div className="h-[280px] animate-pulse rounded-lg bg-[#1f1f1f]" />,
  },
)

export function MrrTrendChart({ period }: MrrTrendChartProps) {
  const { data, isLoading, error } = trpc.adminInsights.getMrrBreakdown.useQuery({ period })

  const chartData = useMemo<MrrTrendPoint[]>(() => {
    if (!data) {
      return []
    }

    return [
      { label: "Last Month", mrr: data.mrrLastMonth },
      { label: "This Month", mrr: data.mrrThisMonth },
    ]
  }, [data])

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <div className="h-[280px] animate-pulse rounded-lg bg-[#1f1f1f]" />
      </div>
    )
  }

  if (error) {
    return <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-red-500">Error loading MRR trend</div>
  }

  if (!data || chartData.every((point) => point.mrr === 0)) {
    return (
      <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <header className="mb-4">
          <h3 className="text-xs uppercase tracking-wider text-[#a1a1a1]">MRR Trend</h3>
        </header>
        <div className="flex h-[280px] items-center justify-center text-sm text-[#a1a1a1]">
          Historical MRR trend data is unavailable. Showing only current/previous month when available.
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <header className="mb-4">
        <h3 className="text-xs uppercase tracking-wider text-[#a1a1a1]">MRR Trend</h3>
      </header>
      <RechartsMrrTrendChart data={chartData} />
    </section>
  )
}
