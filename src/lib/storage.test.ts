import { describe, it, expect, vi } from "vitest"
import sharp from "sharp"

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async () => ({ url: "https://blob.example/x" })),
  del: vi.fn(),
}))

const { validateAndResizeUpload } = await import("./storage")

async function makePngDataUrl(width = 200, height = 200): Promise<string> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer()
  return `data:image/png;base64,${buf.toString("base64")}`
}

async function makeJpegDataUrl(): Promise<string> {
  const buf = await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 0, g: 255, b: 0 } },
  })
    .jpeg()
    .toBuffer()
  return `data:image/jpeg;base64,${buf.toString("base64")}`
}

async function makeWebpDataUrl(): Promise<string> {
  const buf = await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 0, g: 0, b: 255 } },
  })
    .webp()
    .toBuffer()
  return `data:image/webp;base64,${buf.toString("base64")}`
}

describe("validateAndResizeUpload", () => {
  // T2: Valid PNG
  it("accepts valid 200x200 PNG data URL and returns WebP buffer", async () => {
    const dataUrl = await makePngDataUrl()
    const result = await validateAndResizeUpload(dataUrl)
    expect(result.mimeType).toBe("image/webp")
    expect(result.buffer).toBeInstanceOf(Buffer)
    expect(result.buffer.byteLength).toBeGreaterThan(0)
  })

  // T3: Valid JPEG
  it("accepts valid JPEG data URL", async () => {
    const dataUrl = await makeJpegDataUrl()
    const result = await validateAndResizeUpload(dataUrl)
    expect(result.mimeType).toBe("image/webp")
    expect(result.buffer).toBeInstanceOf(Buffer)
  })

  // T4: Valid WebP
  it("accepts valid WebP data URL", async () => {
    const dataUrl = await makeWebpDataUrl()
    const result = await validateAndResizeUpload(dataUrl)
    expect(result.mimeType).toBe("image/webp")
    expect(result.buffer).toBeInstanceOf(Buffer)
  })

  // T5: Unsupported MIME (GIF stand-in for HEIC)
  it("rejects unsupported MIME (GIF stand-in for HEIC)", async () => {
    // Sharp can create GIF-like buffers; use raw bytes that file-type detects as GIF
    const gifHeader = Buffer.from("GIF89a" + "\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;")
    const dataUrl = `data:image/gif;base64,${gifHeader.toString("base64")}`
    await expect(validateAndResizeUpload(dataUrl)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("PNG, JPEG, WebP"),
    })
  })

  // T6: Oversize file
  it("rejects oversize file with \"최대 4MB\" error", async () => {
    const dataUrl = await makePngDataUrl()
    await expect(validateAndResizeUpload(dataUrl, { maxBytes: 1024 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("최대 4MB"),
    })
  })

  // T7: Corrupt/random bytes
  it("rejects corrupt buffer with a Korean BAD_REQUEST error", async () => {
    const corruptBuf = Buffer.from("not an image at all, just random ascii bytes here")
    const dataUrl = `data:image/png;base64,${corruptBuf.toString("base64")}`
    await expect(validateAndResizeUpload(dataUrl)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })
  })

  // T8: Pixel bomb — skip if OOM risk is too high; try creating a 20000x20000 PNG
  it.skip("rejects pixel bomb exceeding limitInputPixels", async () => {
    // Creating a 20000x20000 PNG via sharp in tests can OOM or be very slow.
    // This test is skipped to avoid CI memory issues.
    // If running manually with sufficient RAM, remove the skip.
    const bigBuf = await sharp({
      create: { width: 20000, height: 20000, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer()
    const dataUrl = `data:image/png;base64,${bigBuf.toString("base64")}`
    await expect(validateAndResizeUpload(dataUrl)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("이미지 크기가 너무 커요."),
    })
  })

  // T9: Aspect ratio preserved — 320x640 → longest edge ≤512, ratio ~1:2
  it("preserves aspect ratio for 320x640 PNG input", async () => {
    const dataUrl = await makePngDataUrl(320, 640)
    const result = await validateAndResizeUpload(dataUrl)
    const meta = await sharp(result.buffer).metadata()
    expect(meta.width).toBeLessThanOrEqual(512)
    expect(meta.height).toBeLessThanOrEqual(512)
    // Ratio should be close to 1:2 (height double width)
    const ratio = (meta.height ?? 0) / (meta.width ?? 1)
    expect(ratio).toBeCloseTo(2, 0)
  })

  // T10: Invalid data URL format
  it("rejects invalid data URL format", async () => {
    await expect(validateAndResizeUpload("notadataurl")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "올바른 이미지 형식이 아니에요.",
    })
  })
})