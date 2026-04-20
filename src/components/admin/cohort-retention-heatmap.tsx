"use client"

import { trpc } from "@/lib/trpc/client"

const ROWS = 12
const COLS = 8
const CELL = 28
const LEFT_LABEL_WIDTH = 78
const TOP_LABEL_HEIGHT = 26

const BUCKET_COLORS = [
  "#1a1a1a",
  "rgba(59,130,246,0.2)",
  "rgba(59,130,246,0.4)",
  "rgba(59,130,246,0.7)",
  "#3b82f6",
]

function formatCohortLabel(isoDate: string) {
  const date = new Date(isoDate)
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${month}-${day}`
}

function quantile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p
  const low = Math.floor(idx)
  const high = Math.ceil(idx)
  if (low === high) return sorted[low] ?? 0
  const lowVal = sorted[low] ?? 0
  const highVal = sorted[high] ?? 0
  return lowVal + (highVal - lowVal) * (idx - low)
}

export function CohortRetentionHeatmap() {
  const query = trpc.adminInsights.getCohortRetention.useQuery()

  const rows = (query.data ?? []).map((row) => ({
    cohortWeekStart: String((row as Record<string, unknown>).cohortWeekStart ?? ""),
    retention: Array.from({ length: COLS }, (_, week) => Number((row as Record<string, unknown>)[`w${week}`] ?? 0)),
  }))

  const normalizedRows =
    rows.length === 0
      ? Array.from({ length: ROWS }, (_, index) => ({
          cohortWeekStart: `W${index + 1}`,
          retention: Array.from({ length: COLS }, () => 0),
        }))
      : rows

  const allPositiveValues = normalizedRows
    .flatMap((row) => row.retention)
    .filter((value) => value > 0)
    .sort((a, b) => a - b)

  const q1 = quantile(allPositiveValues, 0.25)
  const q2 = quantile(allPositiveValues, 0.5)
  const q3 = quantile(allPositiveValues, 0.75)

  const getBucket = (value: number) => {
    if (value <= 0) return 0
    if (value <= q1) return 1
    if (value <= q2) return 2
    if (value <= q3) return 3
    return 4
  }

  const width = LEFT_LABEL_WIDTH + COLS * CELL
  const height = TOP_LABEL_HEIGHT + ROWS * CELL

  return (
    <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-[#a1a1a1]">Cohort Retention</h3>
        {query.isLoading ? <span className="text-xs text-[#6b6b6b]">불러오는 중...</span> : null}
      </header>

      {query.isError ? (
        <p className="text-sm text-[#ef4444]">Error loading data</p>
      ) : (
        <div className="overflow-x-auto">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Cohort retention heatmap">
            {Array.from({ length: COLS }, (_, col) => (
              <text
                key={`top-${col}`}
                x={LEFT_LABEL_WIDTH + col * CELL + CELL / 2}
                y={16}
                textAnchor="middle"
                fontSize="11"
                fill="#a1a1a1"
              >
                {`W${col}`}
              </text>
            ))}

            {normalizedRows.slice(0, ROWS).map((row, rowIndex) => (
              <g key={`row-${row.cohortWeekStart}-${rowIndex}`}>
                <text
                  x={LEFT_LABEL_WIDTH - 8}
                  y={TOP_LABEL_HEIGHT + rowIndex * CELL + CELL / 2 + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#a1a1a1"
                >
                  {rows.length === 0 ? row.cohortWeekStart : formatCohortLabel(row.cohortWeekStart)}
                </text>

                {row.retention.slice(0, COLS).map((value, colIndex) => (
                  <g key={`cell-${rowIndex}-${colIndex}`}>
                    <rect
                      x={LEFT_LABEL_WIDTH + colIndex * CELL + 1}
                      y={TOP_LABEL_HEIGHT + rowIndex * CELL + 1}
                      width={CELL - 2}
                      height={CELL - 2}
                      fill={BUCKET_COLORS[getBucket(value)]}
                      stroke="#2a2a2a"
                    />
                    {rows.length === 0 ? (
                      <text
                        x={LEFT_LABEL_WIDTH + colIndex * CELL + CELL / 2}
                        y={TOP_LABEL_HEIGHT + rowIndex * CELL + CELL / 2 + 4}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#6b6b6b"
                      >
                        0%
                      </text>
                    ) : null}
                  </g>
                ))}
              </g>
            ))}
          </svg>
        </div>
      )}
    </section>
  )
}
