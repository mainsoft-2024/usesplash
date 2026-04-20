import { randomUUID } from "node:crypto"
import sharp from "sharp"
import { put, del } from "@vercel/blob"

export function getStorageKey(
  userId: string,
  projectId: string,
  logoId: string,
  versionId: string,
  ext = "png"
 ) {
  return `users/${userId}/projects/${projectId}/logos/${logoId}/${versionId}.${ext}`
}

export async function uploadImage(
  key: string,
  body: Buffer,
  contentType = "image/png"
): Promise<{ url: string; bytes: number }> {
  const blob = await put(key, body, {
    access: "public",
    contentType,
  })
  return { url: blob.url, bytes: body.byteLength }
}

export async function resizeAndUploadImage(
  dataUrl: string,
  projectId: string,
  userId: string
): Promise<{ url: string; mediaType: "image/webp"; bytes: number }> {
  if (dataUrl.startsWith("http")) {
    return { url: dataUrl, mediaType: "image/webp", bytes: 0 }
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    throw new Error("Invalid image data URL")
  }

  const [, , base64Data] = match
  const inputBuffer = Buffer.from(base64Data, "base64")
  const outputBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: 512,
      height: 512,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer()

  const key = `users/${userId}/projects/${projectId}/attachments/${randomUUID()}.webp`
  const blob = await put(key, outputBuffer, {
    access: "public",
    contentType: "image/webp",
  })

  return { url: blob.url, mediaType: "image/webp", bytes: outputBuffer.byteLength }
}

export async function deleteImage(url: string) {
  await del(url)
}

export function getDownloadUrl(url: string): string {
  return url
}
