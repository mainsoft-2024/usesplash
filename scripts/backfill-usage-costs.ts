import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { imageCost } from "../src/lib/pricing"

type BackfillPrismaClient = Pick<PrismaClient, "usageLog">

type BackfillResult = {
  rowsMatched: number
  rowsUpdated: number
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
})

export async function backfillUsageCosts(
  db: BackfillPrismaClient = prisma,
): Promise<BackfillResult> {
  const rows = await db.usageLog.findMany({
    where: {
      imageCostUsd: null,
      type: { in: ["generate", "edit"] },
    },
    select: {
      id: true,
      count: true,
    },
  })

  for (const row of rows) {
    await db.usageLog.update({
      where: { id: row.id },
      data: {
        imageCount: row.count,
        imageCostUsd: imageCost(row.count),
      },
    })
  }

  return {
    rowsMatched: rows.length,
    rowsUpdated: rows.length,
  }
}

async function main() {
  const result = await backfillUsageCosts()
  console.log(
    `[backfill-usage-costs] updated ${result.rowsUpdated} rows (matched ${result.rowsMatched})`,
  )
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
