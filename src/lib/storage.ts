import { randomUUID } from "node:crypto"
import sharp from "sharp"
import { put, del } from "@vercel/blob"
import { TRPCError } from "@trpc/server"
import { fileTypeFromBuffer } from "file-type"
import { MAX_FILE_SIZE, ACCEPTED_TYPES } from "@/lib/attachment-constants"

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

export async function validateAndResizeUpload(
  dataUrl: string,
  opts?: { maxBytes?: number }
): Promise<{ buffer: Buffer; mimeType: "image/webp" }> {
  // Step 1: Parse data URL
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "올바른 이미지 형식이 아니에요." })
  }

  // Step 2: Decode base64 and check size
  const [, , base64Data] = match
  const buffer = Buffer.from(base64Data, "base64")
  const maxBytes = opts?.maxBytes ?? MAX_FILE_SIZE
  if (buffer.byteLength > maxBytes) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "이미지당 최대 4MB까지 업로드할 수 있어요." })
  }

  // Step 3: Detect MIME type from buffer contents
  const detected = await fileTypeFromBuffer(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength))
  if (!detected || !(ACCEPTED_TYPES as readonly string[]).includes(detected.mime)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "PNG, JPEG, WebP 형식만 지원해요. (아이폰 사진은 변환이 필요합니다)",
    })
  }

  // Step 4: Validate with sharp (catches pixel bombs and corrupt files)
  try {
    const metadata = await sharp(buffer, {
      limitInputPixels: 268_435_456,
      failOn: "truncated",
    }).metadata()

    if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "PNG, JPEG, WebP 형식만 지원해요. (아이폰 사진은 변환이 필요합니다)",
      })
    }
  } catch (err) {
    if (err instanceof TRPCError) throw err
    const message = err instanceof Error ? err.message : String(err)
    if (message.toLowerCase().includes("input image exceeds pixel limit") || message.toLowerCase().includes("too large") || message.toLowerCase().includes("exceeded")) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "이미지 크기가 너무 커요." })
    }
    throw new TRPCError({ code: "BAD_REQUEST", message: "이미지를 읽을 수 없어요. 파일이 손상되었을 수 있어요." })
  }

  // Step 5: Resize to WebP
  const outputBuffer = await sharp(buffer, { limitInputPixels: 268_435_456 })
    .rotate()
    .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: false })
    .webp({ quality: 85 })
    .toBuffer()

  return { buffer: outputBuffer, mimeType: "image/webp" }
}
