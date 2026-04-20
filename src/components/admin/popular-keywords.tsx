"use client"

import dynamic from "next/dynamic"
import { trpc } from "@/lib/trpc/client"

const PopularKeywordsChart = dynamic(
  () =>
    import("recharts").then((mod) => {
      const { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } = mod

      return function PopularKeywordsChartInner({ data }: { data: Array<{ keyword: string; count: number }> }) {
        return (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="#6b6b6b" tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="keyword"
                stroke="#a1a1a1"
                tickLine={false}
                axisLine={false}
                width={84}
                interval={0}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "10px",
                  color: "#fff",
                }}
                labelStyle={{ color: "#a1a1a1" }}
              />
              <Bar dataKey="count" fill="var(--accent-green)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )
      }
    }),
  { ssr: false },
)

export function PopularKeywords() {
  const query = trpc.adminInsights.getPopularKeywords.useQuery({ period: "30" })
  const data = (query.data ?? []).slice(0, 15)

  return (
    <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <header className="mb-3">
        <h3 className="text-xs uppercase tracking-wider text-[#a1a1a1]">Popular Keywords</h3>
      </header>

      {query.isLoading ? <p className="text-sm text-[#6b6b6b]">키워드 데이터를 불러오는 중입니다.</p> : null}
      {query.isError ? <p className="text-sm text-[#ef4444]">Error loading data</p> : null}
      {!query.isLoading && !query.isError && data.length === 0 ? (
        <p className="text-sm text-[#6b6b6b]">키워드 데이터가 없습니다.</p>
      ) : null}

      {!query.isLoading && !query.isError && data.length > 0 ? <PopularKeywordsChart data={data} /> : null}
    </section>
  )
}
