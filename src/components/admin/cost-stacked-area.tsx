"use client"

import { useMemo } from "react"
import dynamic from "next/dynamic"
import { trpc } from "../../lib/trpc/client"

type Period = "7" | "30" | "90" | "all"

type CostStackedAreaProps = {
  period: Period
}

type CostBreakdownPoint = {
  date: string
  gemini_image: number
  openrouter_llm: number
  vercel_blob: number
  recraft_vectorize: number
}

const chartColors = {
  gemini_image: "#10b981",
  openrouter_llm: "#8b5cf6",
  vercel_blob: "#3b82f6",
  recraft_vectorize: "#ec4899",
} as const

const RechartsCostStackedArea = dynamic(
  async () => {
    const { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } = await import("recharts")

    return function RechartsCostStackedAreaInner({
      data,
    }: {
      data: CostBreakdownPoint[]
    }) {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gemini-image-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.gemini_image} stopOpacity={0.4} />
                <stop offset="95%" stopColor={chartColors.gemini_image} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="openrouter-llm-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.openrouter_llm} stopOpacity={0.35} />
                <stop offset="95%" stopColor={chartColors.openrouter_llm} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="vercel-blob-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.vercel_blob} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartColors.vercel_blob} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="recraft-vectorize-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.recraft_vectorize} stopOpacity={0.35} />
                <stop offset="95%" stopColor={chartColors.recraft_vectorize} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: "#a1a1a1", fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fill: "#a1a1a1", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(value: number) => `$${value.toFixed(2)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                borderColor: "#2a2a2a",
                borderRadius: "0.5rem",
                color: "#ffffff",
              }}
              formatter={(value, name) => {
                const labelByKey: Record<string, string> = {
                  gemini_image: "Gemini Image",
                  openrouter_llm: "OpenRouter LLM",
                  vercel_blob: "Vercel Blob",
                  recraft_vectorize: "Recraft Vectorize",
                }
                return [`$${Number(value ?? 0).toFixed(4)}`, labelByKey[String(name)] ?? String(name)]
              }}
            />
            <Area type="monotone" dataKey="gemini_image" stackId="cost" stroke={chartColors.gemini_image} fill="url(#gemini-image-fill)" />
            <Area type="monotone" dataKey="openrouter_llm" stackId="cost" stroke={chartColors.openrouter_llm} fill="url(#openrouter-llm-fill)" />
            <Area type="monotone" dataKey="vercel_blob" stackId="cost" stroke={chartColors.vercel_blob} fill="url(#vercel-blob-fill)" />
            <Area type="monotone" dataKey="recraft_vectorize" stackId="cost" stroke={chartColors.recraft_vectorize} fill="url(#recraft-vectorize-fill)" />
          </AreaChart>
        </ResponsiveContainer>
      )
    }
  },
  {
    ssr: false,
    loading: () => <div className="h-[300px] animate-pulse rounded-lg bg-[#1f1f1f]" />,
  },
)

export function CostStackedArea({ period }: CostStackedAreaProps) {
  const { data, isLoading, error } = trpc.adminInsights.getCostBreakdown.useQuery({ period })

  const hasData = useMemo(
    () => !!data && data.some((row: CostBreakdownPoint) => row.gemini_image > 0 || row.openrouter_llm > 0 || row.vercel_blob > 0 || (row.recraft_vectorize ?? 0) > 0),
    [data],
  )

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <div className="h-[300px] animate-pulse rounded-lg bg-[#1f1f1f]" />
      </div>
    )
  }

  if (error) {
    return <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-red-500">Error loading cost data</div>
  }

  if (!hasData || !data) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <div className="flex h-[300px] items-center justify-center text-sm text-[#a1a1a1]">No cost data available</div>
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <header className="mb-4">
        <h3 className="text-xs uppercase tracking-wider text-[#a1a1a1]">API Cost Trend</h3>
      </header>
      <RechartsCostStackedArea data={data} />
    </section>
  )
}
