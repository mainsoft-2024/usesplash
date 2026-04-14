import "dotenv/config"

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

type BackfillRow = {
  userId: string
  count: bigint
  earliest: Date
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
})

async function main() {
  const rows = await prisma.$queryRaw<BackfillRow[]>`
    SELECT p."userId", COUNT(*) as count, MIN(lv."createdAt") as earliest
    FROM "LogoVersion" lv
    JOIN "Logo" l ON lv."logoId" = l.id
    JOIN "Project" p ON l."projectId" = p.id
    GROUP BY p."userId"
  `

  for (const row of rows) {
    const count = Number(row.count)

    await prisma.usageLog.create({
      data: {
        userId: row.userId,
        type: "generate",
        count,
        createdAt: row.earliest,
      },
    })

    console.log(`Backfilled user ${row.userId}: ${count} generations`)
  }

  console.log(`Done. Backfilled ${rows.length} users.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
