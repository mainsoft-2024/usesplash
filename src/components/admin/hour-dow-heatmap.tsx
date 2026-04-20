"use client"

import * as trpcClient from "@/lib/trpc/client"

type Period = "7" | "30" | "90" | "all"

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DOW_LABEL = ["월", "화", "수", "목", "금", "토", "일"]
const BUCKET_COLORS = ["#1a1a1a", "rgba(59,130,246,0.2)", "rgba(59,130,246,0.4)", "rgba(59,130,246,0.7)", "#3b82f6"]

function getQuantiles(values: number[]): [number, number, number] {
  if (values.length === 0) {
    return [0, 0, 0]
  }

  const sorted = [...values].sort((a, b) => a - b)
  const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0
  return [pick(0.25), pick(0.5), pick(0.75)]
}

function bucketFor(value: number, q1: number, q2: number, q3: number): number {
  if (!value) {
    return 0
  }
  if (value <= q1) {
    return 1
  }
  if (value <= q2) {
    return 2
  }
  if (value <= q3) {
    return 3
  }
  return 4
}

interface HourDowHeatmapProps {
  period: Period
}

export function HourDowHeatmap({ period }: HourDowHeatmapProps) {
  const api = ((trpcClient as { api?: unknown; trpc?: unknown }).api ??
    (trpcClient as { api?: unknown; trpc?: unknown }).trpc) as {
    adminInsights: {
      getHourDowHeatmap: {
        useQuery: (input: { period: Period }) => {
          data?: Array<{ hourKst: number; dow: number; count: number }>
          isPending: boolean
          isError: boolean
        }
      }
    }
  }

  const { data, isPending, isError } = api.adminInsights.getHourDowHeatmap.useQuery({ period })

  if (isPending) {
    return <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-[#a1a1a1]">Loading heatmap...</div>
  }

  if (isError) {
    return <p className="rounded-xl border border-[#ef4444]/40 bg-[#7f1d1d]/20 p-4 text-sm text-[#f87171]">Error loading data</p>
  }

  const rows = data ?? []
  if (rows.length === 0) {
    return <p className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-[#6b6b6b]">No usage heatmap data available</p>
  }

  const valueMap = new Map<string, number>()
  for (const row of rows) {
    valueMap.set(`${row.dow}-${row.hourKst}`, row.count)
  }

  const positives = rows.map((row) => row.count).filter((count) => count > 0)
  const [q1, q2, q3] = getQuantiles(positives)

  const cellW = 16
  const cellH = 16
  const gap = 2
  const leftPad = 28
  const topPad = 18
  const width = leftPad + 24 * (cellW + gap)
  const height = topPad + 7 * (cellH + gap)

  return (
    <article className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <p className="text-xs uppercase tracking-wider text-[#a1a1a1]">Hour × Day (KST)</p>
      <div className="mt-3 overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label="Hour-day usage heatmap">
          {Array.from({ length: 24 }).map((_, hour) => (
            <text
              key={`h-${hour}`}
              x={leftPad + hour * (cellW + gap) + cellW / 2}
              y={12}
              textAnchor="middle"
              fontSize="9"
              fill="#a1a1a1"
            >
              {hour}
            </text>
          ))}
          {DOW_ORDER.map((dow, rowIdx) => (
            <g key={`d-${dow}`}>
              <text x={6} y={topPad + rowIdx * (cellH + gap) + 12} fontSize="10" fill="#a1a1a1">
                {DOW_LABEL[rowIdx]}
              </text>
              {Array.from({ length: 24 }).map((_, hour) => {
                const value = valueMap.get(`${dow}-${hour}`) ?? 0
                const bucket = bucketFor(value, q1, q2, q3)
                return (
                  <rect
                    key={`${dow}-${hour}`}
                    x={leftPad + hour * (cellW + gap)}
                    y={topPad + rowIdx * (cellH + gap)}
                    width={cellW}
                    height={cellH}
                    rx={2}
                    fill={BUCKET_COLORS[bucket]}
                    stroke="#2a2a2a"
                  >
                    <title>
                      {`${DOW_LABEL[rowIdx]} ${hour}시: ${value.toLocaleString()}회`}
                    </title>
                  </rect>
                )
              })}
            </g>
          ))}
        </svg>
      </div>
    </article>
  )
}
