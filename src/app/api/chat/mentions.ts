import { prisma } from "@/lib/prisma"
import type { LogoMentionPart } from "@/lib/chat/mention-types"
import { isMentionPart } from "@/lib/chat/mention-types"

type UserMessageLike = {
  parts?: unknown[]
}

type LogoVersionWithLogo = {
  id: string
  versionNumber: number
  imageUrl: string
  logo: {
    id: string
    orderIndex: number
    prompt: string
    projectId: string
  }
}

type PrismaLike = {
  logoVersion: {
    findMany: (args: {
      where: { id: { in: string[] } }
      include: { logo: true }
    }) => Promise<LogoVersionWithLogo[]>
  }
}

export class MentionValidationError extends Error {
  missingVersionIds: string[]

  constructor(missingVersionIds: string[]) {
    super("mention_invalid")
    this.name = "MentionValidationError"
    this.missingVersionIds = missingVersionIds
  }
}

export function extractMentionParts(userMessage: UserMessageLike | null | undefined): LogoMentionPart[] {
  if (!userMessage?.parts?.length) return []
  return userMessage.parts.filter(isMentionPart)
}

export async function validateMentions(
  mentions: LogoMentionPart[],
  projectId: string,
  prismaClient: PrismaLike = prisma as unknown as PrismaLike,
): Promise<LogoVersionWithLogo[]> {
  if (!mentions.length) return []

  const uniqueVersionIds = Array.from(new Set(mentions.map((mention) => mention.data.versionId)))
  const versions = await prismaClient.logoVersion.findMany({
    where: { id: { in: uniqueVersionIds } },
    include: { logo: true },
  })

  const validById = new Map(
    versions.filter((version) => version.logo.projectId === projectId).map((version) => [version.id, version]),
  )
  const missingVersionIds = uniqueVersionIds.filter((versionId) => !validById.has(versionId))

  if (missingVersionIds.length > 0) {
    throw new MentionValidationError(missingVersionIds)
  }

  return uniqueVersionIds.map((versionId) => validById.get(versionId)!)
}

export function renderMentionedVersionsForPrompt(versions: LogoVersionWithLogo[]): string {
  if (versions.length === 0) return ""

  const lines = versions.map((version) => {
    const prompt = version.logo.prompt.length > 200 ? `${version.logo.prompt.slice(0, 200)}...` : version.logo.prompt
    return `- #${version.logo.orderIndex + 1} v${version.versionNumber}: ${prompt}`
  })

  return ["## User-mentioned logo versions", ...lines].join("\n")
}

export async function fetchImageBufferFromUrl(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const mimeType = response.headers.get("content-type") ?? "image/png"

  return { buffer, mimeType }
}
