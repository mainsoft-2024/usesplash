"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { trpc } from "@/lib/trpc/client"

const RechartsBar = dynamic(
  () => import("recharts").then((mod) => {
    const { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } = mod
    function Chart({ data }: { data: Array<{ label: string; count: number }> }) {
      return (
        <ResponsiveContainer width="100%" height={200}>
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
    loading: () => <div className="h-[200px] animate-pulse rounded-xl bg-[var(--bg-primary)]" />,
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
    <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="rounded-xl bg-[var(--bg-primary)] p-4">
            <div className="mb-3 h-4 w-20 animate-pulse rounded bg-[var(--bg-tertiary)]" />
            <div className="h-8 w-24 animate-pulse rounded bg-[var(--bg-tertiary)]" />
          </div>
        ))}
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="h-8 w-14 animate-pulse rounded-lg bg-[var(--bg-primary)]" />
        ))}
      </div>
      <div className="h-[200px] animate-pulse rounded-xl bg-[var(--bg-primary)]" />
    </section>
  )
}

export function UsageStats() {
  const [days, setDays] = useState<RangeDays>(7)
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

  const { total, today, remaining, tier, dailyLimit } = usageQuery.data
  const isUnlimited = dailyLimit < 0
  const progressPercent = isUnlimited
    ? 100
    : Math.max(0, Math.min(100, ((dailyLimit - remaining) / dailyLimit) * 100))

  return (
    <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl bg-[var(--bg-primary)] p-4">
          <p className="text-sm text-[var(--text-tertiary)]">총 생성 수</p>
          <p className="mt-2 text-2xl font-bold text-[var(--accent-green)]">{total.toLocaleString()}</p>
        </div>

        <div className="rounded-xl bg-[var(--bg-primary)] p-4">
          <p className="text-sm text-[var(--text-tertiary)]">오늘 사용량</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {today.toLocaleString()}
            <span className="ml-1 text-base text-[var(--text-secondary)]">
              / {isUnlimited ? "무제한" : dailyLimit.toLocaleString()}
            </span>
          </p>
        </div>

        <div className="rounded-xl bg-[var(--bg-primary)] p-4">
          <p className="text-sm text-[var(--text-tertiary)]">남은 횟수</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {isUnlimited ? "무제한" : remaining.toLocaleString()}
          </p>
          <div className="mt-3 h-2 rounded-full bg-[var(--bg-primary)]">
            <div
              className="h-2 rounded-full bg-[var(--accent-green)] transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl bg-[var(--bg-primary)] p-4">
          <p className="text-sm text-[var(--text-tertiary)]">구독 등급</p>
          <div className="mt-2 inline-flex rounded-full bg-[var(--bg-secondary)] px-3 py-1 text-sm font-semibold text-white">
            {tier.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
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

      <div className="h-[200px]">
        <RechartsBar data={chartData} />
      </div>
    </section>
  )
}
