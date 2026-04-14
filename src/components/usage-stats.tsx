"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { trpc } from "@/lib/trpc/client"

type RangeDays = 7 | 30 | 90

type ChartPoint = {
  date: string
  count: number
  label: string
}

const RechartsArea = dynamic(
  () =>
    import("recharts").then((mod) => {
      const {
        Area,
        AreaChart,
        CartesianGrid,
        ResponsiveContainer,
        Tooltip,
        XAxis,
        YAxis,
      } = mod

      function Chart({ data }: { data: ChartPoint[] }) {
        return (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-green)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--accent-green)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2a2a2a" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#6b6b6b", fontSize: 12 }}
                axisLine={{ stroke: "#2a2a2a" }}
                tickLine={{ stroke: "#2a2a2a" }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#6b6b6b", fontSize: 12 }}
                axisLine={{ stroke: "#2a2a2a" }}
                tickLine={{ stroke: "#2a2a2a" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "10px",
                  color: "#fff",
                }}
                labelStyle={{ color: "#a1a1a1" }}
                cursor={{ stroke: "var(--accent-green)", strokeOpacity: 0.25 }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--accent-green)"
                strokeWidth={2}
                fill="url(#usageGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )
      }

      Chart.displayName = "RechartsArea"
      return Chart
    }),
  {
    ssr: false,
    loading: () => <div className="h-[240px] animate-pulse rounded-xl bg-[#141414]" />,
  },
)

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "좋은 아침이에요 ☀️"
  if (hour < 18) return "좋은 오후예요 ✨"
  return "좋은 저녁이에요 🌙"
}

function UsageStatsSkeleton() {
  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-sm">
      <div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#141414] px-6 py-4">
        <div className="h-6 w-40 animate-pulse rounded bg-[#2a2a2a]" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-[#2a2a2a]" />
      </div>

      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3">
        <div className="flex flex-col items-center gap-4">
          <div className="h-4 w-16 animate-pulse rounded bg-[#2a2a2a]" />
          <div className="h-[120px] w-[120px] animate-pulse rounded-full bg-[#141414]" />
          <div className="h-4 w-20 animate-pulse rounded bg-[#2a2a2a]" />
        </div>
        <div className="flex flex-col justify-center gap-3">
          <div className="h-4 w-24 animate-pulse rounded bg-[#2a2a2a]" />
          <div className="h-10 w-32 animate-pulse rounded bg-[#2a2a2a]" />
          <div className="h-4 w-28 animate-pulse rounded bg-[#2a2a2a]" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-4 w-16 animate-pulse rounded bg-[#2a2a2a]" />
          <div className="h-12 w-full animate-pulse rounded bg-[#141414]" />
          <div className="h-4 w-24 animate-pulse rounded bg-[#2a2a2a]" />
        </div>
      </div>

      <div className="border-t border-[#2a2a2a] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-5 w-28 animate-pulse rounded bg-[#2a2a2a]" />
          <div className="h-9 w-40 animate-pulse rounded-lg bg-[#141414]" />
        </div>
        <div className="h-[240px] animate-pulse rounded-xl bg-[#141414]" />
      </div>
    </section>
  )
}

export function UsageStats() {
  const [days, setDays] = useState<RangeDays>(30)
  const [animatedPercent, setAnimatedPercent] = useState(0)

  const usageQuery = trpc.usage.getMyUsageStats.useQuery()
  const chartQuery = trpc.usage.getDailyChart.useQuery({ days })
  const sparklineQuery = trpc.usage.getDailyChart.useQuery({ days: 7 })

  const chartData = useMemo<ChartPoint[]>(
    () =>
      (chartQuery.data ?? []).map((item) => ({
        ...item,
        label: formatDateLabel(item.date),
      })),
    [chartQuery.data],
  )

  const sparklineData = useMemo(
    () => sparklineQuery.data ?? [],
    [sparklineQuery.data],
  )

  const sparklinePoints = useMemo(() => {
    if (sparklineData.length === 0) return ""

    const width = 280
    const height = 56
    const padding = 4
    const max = Math.max(...sparklineData.map((item) => item.count), 1)

    return sparklineData
      .map((item, index) => {
        const x =
          sparklineData.length === 1
            ? width / 2
            : (index / (sparklineData.length - 1)) * (width - padding * 2) + padding
        const y = height - (item.count / max) * (height - padding * 2) - padding
        return `${x},${y}`
      })
      .join(" ")
  }, [sparklineData])

  const dailyLimit = usageQuery.data?.dailyLimit ?? 0
  const remaining = usageQuery.data?.remaining ?? 0
  const isUnlimited = dailyLimit < 0
  const usedToday = isUnlimited ? usageQuery.data?.today ?? 0 : Math.max(0, dailyLimit - remaining)
  const actualPercent = isUnlimited
    ? 100
    : dailyLimit > 0
      ? Math.max(0, Math.min(100, (usedToday / dailyLimit) * 100))
      : 0

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimatedPercent(actualPercent))
    return () => cancelAnimationFrame(frame)
  }, [actualPercent])

  if (usageQuery.isLoading || chartQuery.isLoading || sparklineQuery.isLoading) {
    return <UsageStatsSkeleton />
  }

  if (
    usageQuery.isError ||
    chartQuery.isError ||
    sparklineQuery.isError ||
    !usageQuery.data ||
    !chartQuery.data ||
    !sparklineQuery.data
  ) {
    return (
      <section className="mb-8 overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 shadow-sm">
        <p className="text-sm text-red-400">사용량 통계를 불러오지 못했습니다.</p>
      </section>
    )
  }

  const { total, today, tier } = usageQuery.data
  const ringRadius = 48
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset = ringCircumference - (animatedPercent / 100) * ringCircumference
  const ringColor = actualPercent > 90 ? "#ef4444" : "var(--accent-green)"

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-sm">
      <header className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#141414] px-6 py-4">
        <h3 className="text-lg font-semibold text-white">{getGreeting()}</h3>
        <span className="inline-flex items-center rounded-full border border-[var(--accent-green)]/20 bg-[var(--accent-green)]/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent-green)]">
          {tier}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-[#a1a1a1]">사용량</p>
          <div className="relative h-[120px] w-[120px]">
            <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
              <circle cx="60" cy="60" r={ringRadius} fill="none" stroke="#2a2a2a" strokeWidth="8" />
              <circle
                cx="60"
                cy="60"
                r={ringRadius}
                fill="none"
                stroke={ringColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-white">{Math.round(animatedPercent)}%</span>
            </div>
          </div>
          <p className="text-sm text-[#a1a1a1]">
            {today.toLocaleString()} / {isUnlimited ? "무제한" : dailyLimit.toLocaleString()}
          </p>
        </div>

        <div className="flex flex-col justify-center gap-2">
          <p className="text-sm text-[#a1a1a1]">총 생성 이미지</p>
          <p className="text-4xl font-bold text-white">{total.toLocaleString()}</p>
          <p className="text-sm text-[#6b6b6b]">오늘 {today.toLocaleString()}건 생성</p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#a1a1a1]">7일 추이</p>
          <div className="rounded-lg border border-[#2a2a2a] bg-[#141414] p-2">
            <svg viewBox="0 0 280 56" className="h-14 w-full">
              {sparklinePoints ? (
                <polyline
                  fill="none"
                  stroke="var(--accent-green)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={sparklinePoints}
                />
              ) : null}
            </svg>
          </div>
          <p className="text-sm text-[var(--accent-green)]">
            남은 생성 가능 횟수: {isUnlimited ? "무제한" : remaining.toLocaleString()}
          </p>
        </div>
      </div>

      <footer className="border-t border-[#2a2a2a] p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h4 className="text-base font-semibold text-white">일별 생성 추이</h4>
          <div className="flex items-center rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-1">
            {([7, 30, 90] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                className={
                  value === days
                    ? "rounded-md bg-[#2a2a2a] px-3 py-1 text-sm font-medium text-white shadow-sm transition-all"
                    : "rounded-md px-3 py-1 text-sm font-medium text-[#6b6b6b] transition-all hover:text-[#a1a1a1]"
                }
>
                {value}일
              </button>
            ))}
          </div>
        </div>
        <RechartsArea data={chartData} />
      </footer>
    </section>
  )
}