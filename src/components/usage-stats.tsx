"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { trpc } from "@/lib/trpc/client"

const RechartsBar = dynamic(
  () => import("recharts").then((mod) => {
    const { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } = mod
    function Chart({ data }: { data: Array<{ label: string; count: number }> }) {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid stroke="#333" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#888", fontSize: 12 }}
              axisLine={{ stroke: "#333" }}
              tickLine={{ stroke: "#333" }}
            />
            <YAxis
              tick={{ fill: "#888", fontSize: 12 }}
              axisLine={{ stroke: "#333" }}
              tickLine={{ stroke: "#333" }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: "10px",
                color: "#fff",
              }}
              labelStyle={{ color: "#fff" }}
              cursor={{ fill: "rgba(76, 175, 80, 0.15)" }}
            />
            <Bar dataKey="count" fill="var(--accent-green)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )
    }
    Chart.displayName = "RechartsBar"
    return Chart
  }),
  {
    ssr: false,
    loading: () => <div className="h-[240px] animate-pulse rounded-xl bg-[var(--bg-primary)]" />,
  },
)

type RangeDays = 7 | 30 | 90

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function UsageStatsSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="col-span-1 flex flex-col justify-between rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
        <div>
          <div className="mb-6 h-6 w-20 animate-pulse rounded-full bg-[var(--bg-primary)]" />
          <div className="mb-2 h-4 w-24 animate-pulse rounded bg-[var(--bg-primary)]" />
          <div className="h-10 w-28 animate-pulse rounded bg-[var(--bg-primary)]" />
        </div>
        <div>
          <div className="mb-3 h-4 w-24 animate-pulse rounded bg-[var(--bg-primary)]" />
          <div className="h-3 w-full animate-pulse rounded-full bg-[var(--bg-primary)]" />
          <div className="mt-3 h-4 w-32 animate-pulse rounded bg-[var(--bg-primary)]" />
        </div>
      </div>
      <div className="col-span-2 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="h-5 w-24 animate-pulse rounded bg-[var(--bg-primary)]" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-8 w-12 animate-pulse rounded-lg bg-[var(--bg-primary)]" />
            ))}
          </div>
        </div>
        <div className="h-[240px] animate-pulse rounded-xl bg-[var(--bg-primary)]" />
      </div>
    </section>
  )
}

export function UsageStats() {
  const [days, setDays] = useState<RangeDays>(7)
  const [animatedPercent, setAnimatedPercent] = useState(0)

  const usageQuery = trpc.usage.getMyUsageStats.useQuery()
  const chartQuery = trpc.usage.getDailyChart.useQuery({ days })

  const chartData = useMemo(
    () =>
      (chartQuery.data ?? []).map((item) => ({
        ...item,
        label: formatDateLabel(item.date),
      })),
    [chartQuery.data],
  )

  const dailyLimit = usageQuery.data?.dailyLimit ?? 0
  const remaining = usageQuery.data?.remaining ?? 0
  const isUnlimited = dailyLimit < 0
  const actualPercent = isUnlimited
    ? 100
    : dailyLimit > 0
      ? Math.max(0, Math.min(100, ((dailyLimit - remaining) / dailyLimit) * 100))
      : 0

  useEffect(() => {
    const t = setTimeout(() => setAnimatedPercent(actualPercent), 100)
    return () => clearTimeout(t)
  }, [actualPercent])

  if (usageQuery.isLoading || chartQuery.isLoading) {
    return <UsageStatsSkeleton />
  }

  if (usageQuery.isError || chartQuery.isError || !usageQuery.data || !chartQuery.data) {
    return (
      <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
        <p className="text-sm text-red-400">사용량 통계를 불러오지 못했습니다.</p>
      </section>
    )
  }

  const { total, today, tier } = usageQuery.data

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="col-span-1 flex flex-col justify-between rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
        <div>
          <div className="inline-flex items-center rounded-full border border-[var(--accent-green)]/20 bg-[var(--accent-green)]/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent-green)]">
            {tier} 플랜
          </div>
          <p className="mt-6 text-sm text-[var(--text-tertiary)]">총 생성 이미지</p>
          <p className="mt-1 text-3xl font-bold text-white">{total.toLocaleString()}</p>
        </div>

        <div className="mt-8">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm text-[var(--text-tertiary)]">오늘 사용량</p>
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              {today.toLocaleString()} / {isUnlimited ? "무제한" : dailyLimit.toLocaleString()}
            </p>
          </div>
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-[var(--bg-primary)] shadow-inner">
            <div
              className="h-full rounded-full bg-[var(--accent-green)] transition-all duration-1000 ease-out"
              style={{ width: `${animatedPercent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            남은 생성 가능 횟수: {isUnlimited ? "무제한" : remaining.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="col-span-2 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">일별 생성 추이</h3>
          <div className="flex gap-2">
            {([7, 30, 90] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                className={
                  value === days
                    ? "rounded-lg bg-[var(--accent-green)] px-3 py-1.5 text-sm font-medium text-white"
                    : "rounded-lg bg-[var(--bg-primary)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)]"
                }
              >
                {value}일
              </button>
            ))}
          </div>
        </div>
        <div className="h-[240px]">
          <RechartsBar data={chartData} />
        </div>
      </div>
    </section>
  )
}