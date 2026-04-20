import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

type CaptionMap = Record<number, string>

/**
 * Optional `pick` = array of [originalVersionNumber, caption] tuples.
 * When provided, only those versions are exported, in the given order,
 * renumbered sequentially from 1. Otherwise all versions are exported
 * with the `captions` map keyed by original versionNumber.
 */
type SequenceSpec = {
  id: string
  name: string
  tagline: string
  logoId: string
  captions?: CaptionMap
  pick?: Array<[number, string]>
}

const SEQUENCES: SequenceSpec[] = [
  {
    id: 'splash',
    name: 'Splash 로고',
    tagline: '우리 브랜드 로고가 완성된 과정',
    logoId: 'cmnxzyp3t000304jyhml2aaun',
    // Curated 10 highlights from the original 20-step history.
    pick: [
      [1,  '무지개 물감이 튄 느낌으로 splash 로고 하나 만들어줘'],
      [2,  '맨 앞 s랑 맨 끝 h 색도 무지개에 자연스럽게 녹여봐'],
      [3,  '글자를 반투명 뿌연 유리처럼 바꿔봐, 뒤로 물감이 비치게'],
      [4,  '더 맑고 투명하게, 빛도 확실하게 꺾이게 해줘'],
      [6,  '물감은 좀 줄이고 여백을 넉넉하게, 화면에 다 들어오게'],
      [9,  '글자는 처음처럼 크고 또렷하게 키워봐'],
      [14, '뒷배경은 아예 새하얗게, 티끌 하나 없이'],
      [15, '가로로 긴 사이즈로 바꿔봐, 위에 박기 좋게'],
      [17, '글자 큼직하게 키워, 한눈에 확 들어오게'],
      [20, '뒤에 물감은 다 지워버리고, 글자만 남기자'],
    ],
  },
  {
    id: 'pixelquest',
    name: 'PIXEL QUEST 로고',
    tagline: '게임 로고 하나를 이렇게도 저렇게도',
    logoId: 'cmnx9lj7b000104ihbb1s3nmp',
    captions: {
      1: '옛날 게임 느낌 나는 픽셀 로고 하나 만들어줘, 검이랑 성 같이',
      2: '전체적으로 초록색 계열로 싹 바꿔봐',
      3: '더 초록초록하게 만들어줘...',
      4: '가운데 검 두 자루는 검이랑 창이 부딪치는 걸로, 부딪치는 자리에 반짝이도 넣어',
      5: '다시 처음 금색 파랑 버전으로 돌아가서, 검이랑 창 부딪치는 걸로 바꿔줘',
    },
  },
]

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const p = new PrismaClient({ adapter })
  const out = { sequences: [] as unknown[] }
  for (const seq of SEQUENCES) {
    const logo = await p.logo.findUnique({
      where: { id: seq.logoId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    })
    if (!logo) throw new Error(`logo not found: ${seq.logoId}`)
    const byNumber = new Map(logo.versions.map((v) => [v.versionNumber, v]))
    let versions: Array<{ n: number; url: string; caption: string; editPrompt: string | null; parent: string | null; createdAt: string; originalN: number }>
    if (seq.pick) {
      versions = seq.pick.map(([origN, caption], i) => {
        const v = byNumber.get(origN)
        if (!v) throw new Error(`${seq.id}: version ${origN} not found`)
        return {
          n: i + 1,
          url: v.imageUrl,
          caption,
          editPrompt: v.editPrompt,
          parent: v.parentVersionId,
          createdAt: v.createdAt.toISOString(),
          originalN: v.versionNumber,
        }
      })
    } else {
      const captions = seq.captions ?? {}
      versions = logo.versions.map((v) => ({
        n: v.versionNumber,
        url: v.imageUrl,
        caption: captions[v.versionNumber] ?? '',
        editPrompt: v.editPrompt,
        parent: v.parentVersionId,
        createdAt: v.createdAt.toISOString(),
        originalN: v.versionNumber,
      }))
    }
    out.sequences.push({
      id: seq.id,
      name: seq.name,
      tagline: seq.tagline,
      initialPrompt: logo.prompt,
      versions,
    })
    console.log(`  ${seq.id}: ${versions.length} versions (from ${logo.versions.length} in DB)`)
  }
  writeFileSync('src/lib/logo-evolution.json', JSON.stringify(out, null, 2))
  console.log(`wrote ${out.sequences.length} sequences`)
  await p.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
