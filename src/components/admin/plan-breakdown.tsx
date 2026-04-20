"use client"

import dynamic from "next/dynamic"

const RechartsPlanBreakdown = dynamic(
  async () => {
    const { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } = await import("recharts")

    return function RechartsPlanBreakdownInner({
      data,
    }: {
      data: Array<{ name: string; value: number; color: string }>
    }) {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={72} outerRadius={100} paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                borderColor: "#2a2a2a",
                borderRadius: "0.5rem",
                color: "#ffffff",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )
    }
  },
  {
    ssr: false,
    loading: () => <div className="h-[280px] animate-pulse rounded-lg bg-[#1f1f1f]" />,
  },
)

const placeholderData = [
  { name: "Pro", value: 0, color: "#10b981" },
  { name: "Enterprise", value: 0, color: "#a855f7" },
  { name: "Demo", value: 0, color: "#3b82f6" },
  { name: "Free", value: 0, color: "#525252" },
]

export function PlanBreakdown() {
  return (
    <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <header className="mb-4">
        <h3 className="text-xs uppercase tracking-wider text-[#a1a1a1]">Plan Breakdown</h3>
      </header>
      <RechartsPlanBreakdown data={placeholderData} />
      <p className="mt-3 text-sm text-[#a1a1a1]">
        미구현: 현재 수익 탭 범위에서는 플랜별 활성 사용자 집계 데이터 소스가 연결되지 않았습니다.
      </p>
    </section>
  )
}
