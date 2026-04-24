"use client"

import { trpc } from "../../lib/trpc/client"

type Period = "7" | "30" | "90" | "all"

type CostTotalsRowProps = {
  period: Period
}

type CostBreakdownPoint = {
  gemini_image: number
  openrouter_llm: number
  vercel_blob: number
  recraft_vectorize: number
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function CostTotalsRow({ period }: CostTotalsRowProps) {
  const { data, isLoading, error } = trpc.adminInsights.getCostBreakdown.useQuery({ period })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="h-24 animate-pulse rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4" />
        ))}
      </div>
    )
  }

  if (error) {
    return <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-red-500">Error loading totals</div>
  }

  const totals = (data ?? []).reduce(
    (acc: { gemini: number; llm: number; blob: number; vectorize: number }, row: CostBreakdownPoint) => {
      acc.gemini += row.gemini_image
      acc.llm += row.openrouter_llm
      acc.blob += row.vercel_blob
      acc.vectorize += row.recraft_vectorize ?? 0
      return acc
    },
    { gemini: 0, llm: 0, blob: 0, vectorize: 0 },
  )

  const grandTotal = totals.gemini + totals.llm + totals.blob + totals.vectorize
  const hasData = grandTotal > 0

  if (!hasData) {
    return <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-[#a1a1a1]">No cost data available</div>
  }

  const cards = [
    { label: "Gemini Image", value: totals.gemini, color: "#10b981" },
    { label: "OpenRouter LLM", value: totals.llm, color: "#8b5cf6" },
    { label: "Vercel Blob", value: totals.blob, color: "#3b82f6" },
    { label: "Recraft Vectorize", value: totals.vectorize, color: "#ec4899" },
    { label: "Total", value: grandTotal, color: "#ffffff" },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <article key={card.label} className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
          <p className="text-xs uppercase tracking-wider text-[#a1a1a1]">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight font-tabular-nums" style={{ color: card.color }}>
            {currency.format(card.value)}
          </p>
        </article>
      ))}
    </div>
  )
}
