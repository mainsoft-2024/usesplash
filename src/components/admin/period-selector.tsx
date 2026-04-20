"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

export type InsightsPeriod = "7" | "30" | "90" | "all"

const PERIOD_OPTIONS: Array<{ value: InsightsPeriod; label: string }> = [
  { value: "7", label: "7일" },
  { value: "30", label: "30일" },
  { value: "90", label: "90일" },
  { value: "all", label: "전체" },
]

function parsePeriod(value: string | null): InsightsPeriod {
  if (value === "7" || value === "30" || value === "90" || value === "all") {
    return value
  }

  return "30"
}

export function PeriodSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activePeriod = parsePeriod(searchParams.get("period"))

  const setPeriod = (period: InsightsPeriod) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("period", period)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-1">
      {PERIOD_OPTIONS.map((option) => {
        const isActive = option.value === activePeriod

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setPeriod(option.value)}
            className={[
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-[#1f1f1f] text-white"
                : "text-[#a1a1a1] hover:bg-[#1f1f1f] hover:text-white",
            ].join(" ")}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
