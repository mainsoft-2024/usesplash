import { describe, expect, it } from "vitest"
import { LogoMentionPartSchema, isMentionPart } from "./mention-types"

describe("LogoMentionPartSchema", () => {
  it("accepts valid mention part and round-trips", () => {
    const value = {
      type: "data-mention",
      data: {
        logoId: "logo-1",
        versionId: "version-1",
        orderIndex: 0,
        versionNumber: 1,
        imageUrl: "https://example.com/logo.png",
      },
    }

    const parsed = LogoMentionPartSchema.parse(value)
    expect(parsed).toEqual(value)
    expect(isMentionPart(parsed)).toBe(true)
  })

  it("rejects missing versionId", () => {
    const value = {
      type: "data-mention",
      data: {
        logoId: "logo-1",
        orderIndex: 0,
        versionNumber: 1,
        imageUrl: "https://example.com/logo.png",
      },
    }

    expect(() => LogoMentionPartSchema.parse(value)).toThrow()
  })

  it("rejects unknown fields due to strict schema", () => {
    const value = {
      type: "data-mention",
      data: {
        logoId: "logo-1",
        versionId: "version-1",
        orderIndex: 0,
        versionNumber: 1,
        imageUrl: "https://example.com/logo.png",
      },
      extra: true,
    }

    expect(() => LogoMentionPartSchema.parse(value)).toThrow()
  })
})
