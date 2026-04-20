"use client"

import { useEffect, useMemo, useState } from "react"

import * as trpcClient from "@/lib/trpc/client"

const DISMISS_KEY = "admin-insights:dismissed-banners"

type BannerLevel = "warning" | "danger" | "info"

interface Banner {
  id: string
  level: BannerLevel
  title: string
  message: string
}

function parseNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function classForLevel(level: BannerLevel) {
  if (level === "danger") {
    return "bg-[#7f1d1d]/20 border border-[#ef4444]/50 text-[#f87171]"
  }

  if (level === "info") {
    return "bg-[#1e3a8a]/20 border border-[#3b82f6]/50 text-[#60a5fa]"
  }

  return "bg-[#78350f]/20 border border-[#f59e0b]/50 text-[#fbbf24]"
}

export function ThresholdBanners() {
  const api = ((trpcClient as { api?: unknown; trpc?: unknown }).api ??
    (trpcClient as { api?: unknown; trpc?: unknown }).trpc) as {
    adminInsights: {
      getOverviewKpis: { useQuery: (input: { period: "30" }) => { data?: { marginUsd?: number | string | null } } }
      getMrrBreakdown: { useQuery: (input: { period: "30" }) => { data?: { mrrThisMonth?: number | string | null } } }
      getGeminiHealth: { useQuery: () => { data?: { rate429Pct24h?: number | string | null } } }
    }
  }

  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const { data: overview } = api.adminInsights.getOverviewKpis.useQuery({ period: "30" })
  const { data: mrr } = api.adminInsights.getMrrBreakdown.useQuery({ period: "30" })
  const { data: gemini } = api.adminInsights.getGeminiHealth.useQuery()

  useEffect(() => {
    const raw = window.sessionStorage.getItem(DISMISS_KEY)
    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as string[]
      setDismissed(new Set(parsed))
    } catch {
      setDismissed(new Set())
    }
  }, [])

  const banners = useMemo<Banner[]>(() => {
    const mrrThisMonth = parseNumber(mrr?.mrrThisMonth)
    const marginUsd = parseNumber(overview?.marginUsd)
    const rate429Pct24h = parseNumber(gemini?.rate429Pct24h)

    const estimatedCost = mrrThisMonth - marginUsd
    const costRatio = mrrThisMonth > 0 ? (estimatedCost / mrrThisMonth) * 100 : 0

    const next: Banner[] = []

    if (costRatio > 30) {
      next.push({
        id: "high-cost-ratio",
        level: "warning",
        title: "비용 경고",
        message: `비용 비중이 ${costRatio.toFixed(1)}%로 30%를 초과했습니다.`,
      })
    }

    if (rate429Pct24h > 5) {
      next.push({
        id: "high-gemini-429",
        level: "warning",
        title: "Gemini 429 증가",
        message: `최근 24시간 429 비율이 ${rate429Pct24h.toFixed(1)}%입니다.`,
      })
    }

    if (marginUsd < 0) {
      next.push({
        id: "negative-margin",
        level: "danger",
        title: "마진 음수",
        message: "현재 총 마진이 음수입니다. 즉시 비용 구조를 점검하세요.",
      })
    }

    return next
  }, [gemini?.rate429Pct24h, mrr?.mrrThisMonth, overview?.marginUsd])

  const visibleBanners = banners.filter((banner) => !dismissed.has(banner.id))

  const dismiss = (id: string) => {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(next)))
  }

  if (visibleBanners.length === 0) {
    return null
  }

  return (
    <div className="mb-6 space-y-3">
      {visibleBanners.map((banner) => (
        <div key={banner.id} className={`flex items-start justify-between gap-3 rounded-lg p-3 ${classForLevel(banner.level)}`}>
          <div>
            <p className="text-sm font-semibold">{banner.title}</p>
            <p className="text-sm">{banner.message}</p>
          </div>
          <button type="button" className="text-xs opacity-80 transition-opacity hover:opacity-100" onClick={() => dismiss(banner.id)}>
            닫기
          </button>
        </div>
      ))}
    </div>
  )
}
