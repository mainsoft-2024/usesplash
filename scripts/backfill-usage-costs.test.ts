import { describe, expect, it, vi } from "vitest"
import { backfillUsageCosts } from "./backfill-usage-costs"

describe("backfillUsageCosts", () => {
  it("is idempotent and no-ops on second run", async () => {
    const rows = [
      { id: "a", count: 2 },
      { id: "b", count: 1 },
    ]
    const findMany = vi
      .fn()
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([])
    const update = vi.fn().mockResolvedValue(undefined)

    const db = {
      usageLog: {
        findMany,
        update,
      },
    } as any

    const firstRun = await backfillUsageCosts(db)
    expect(firstRun.rowsMatched).toBe(2)
    expect(firstRun.rowsUpdated).toBe(2)
    expect(update).toHaveBeenCalledTimes(2)

    const secondRun = await backfillUsageCosts(db)
    expect(secondRun.rowsMatched).toBe(0)
    expect(secondRun.rowsUpdated).toBe(0)
    expect(update).toHaveBeenCalledTimes(2)
  })
})
