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
): Promise<string> {
  const blob = await put(key, body, {
    access: "public",
    contentType,
  })
  return blob.url
}

export async function deleteImage(url: string) {
  await del(url)
}

export function getDownloadUrl(url: string): string {
  return url
}
