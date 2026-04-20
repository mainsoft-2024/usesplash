import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const p = new PrismaClient({ adapter })
  const pid = process.argv[2] || 'cmnx9cdxp000004juro4o0yx4'
  const logos = await p.logo.findMany({
    where: { projectId: pid },
    include: { versions: { orderBy: { versionNumber: 'asc' } } },
    orderBy: { orderIndex: 'asc' },
  })
  for (const l of logos) {
    console.log(`\n=== Logo orderIndex=${l.orderIndex} id=${l.id} versions=${l.versions.length}`)
    console.log(`prompt: ${l.prompt.slice(0, 260)}`)
    for (const v of l.versions) {
      console.log(`  v${v.versionNumber} parent=${v.parentVersionId || '-'} edit="${(v.editPrompt || '').slice(0, 220)}"`)
      console.log(`     url=${v.imageUrl}`)
    }
  }
  await p.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
