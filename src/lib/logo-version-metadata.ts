import { z } from "zod"

export const cropRectSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(10),
  height: z.number().int().min(10),
})

export const logoVersionMetadataSchema = z.object({
  source: z.enum(["generate", "edit", "upload", "crop_manual", "crop_auto"]),
  cropRect: cropRectSchema.nullable().optional(),
  sourceVersionId: z.string().optional(),
})

export type LogoVersionMetadata = z.infer<typeof logoVersionMetadataSchema>
export type CropRect = z.infer<typeof cropRectSchema>

export function parseMetadata(json: unknown): LogoVersionMetadata | null {
  if (json === null || json === undefined) return null
  const parsed = logoVersionMetadataSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}