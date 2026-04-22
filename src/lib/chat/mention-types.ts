import { z } from "zod"

export const LogoMentionDataSchema = z
  .object({
    logoId: z.string().min(1),
    versionId: z.string().min(1),
    orderIndex: z.number().int().min(0),
    versionNumber: z.number().int().min(1),
    imageUrl: z.string().url(),
  })
  .strict()

export const LogoMentionPartSchema = z
  .object({
    type: z.literal("data-mention"),
    data: LogoMentionDataSchema,
  })
  .strict()

export type LogoMentionData = z.infer<typeof LogoMentionDataSchema>
export type LogoMentionPart = z.infer<typeof LogoMentionPartSchema>

export function isMentionPart(part: unknown): part is LogoMentionPart {
  return LogoMentionPartSchema.safeParse(part).success
}
