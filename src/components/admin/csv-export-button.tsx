"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import type { UserFilters } from "./user-filter-bar"

type CsvExportButtonProps = {
  filters: UserFilters
}

export function CsvExportButton({ filters }: CsvExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isError, setIsError] = useState(false)
  const utils = trpc.useUtils()

  const handleExport = async () => {
    setIsExporting(true)
    setIsError(false)
    try {
      const result = await utils.adminInsights.exportUsersCsv.fetch({
        search: filters.search || undefined,
        tiers: filters.tiers.length > 0 ? filters.tiers : undefined,
        activity: filters.activity === "all" ? undefined : filters.activity,
        signupFrom: filters.signupFrom || undefined,
        signupTo: filters.signupTo || undefined,
      })

      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = result.filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch {
      setIsError(true)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="h-10 rounded-lg border border-[#2a2a2a] px-3 text-sm text-[#a1a1a1] transition-colors hover:border-[#a1a1a1] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isExporting ? "내보내는 중..." : "CSV 내보내기"}
      </button>
      {isError ? <p className="text-xs text-red-400">CSV 내보내기에 실패했습니다.</p> : null}
    </div>
  )
}
