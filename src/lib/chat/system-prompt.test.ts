import { describe, expect, it } from "vitest"
import { buildSystemPrompt, LOGO_DESIGNER_SYSTEM_PROMPT } from "./system-prompt"

describe("buildSystemPrompt", () => {
  it("does not include mention header when mentionedSection is absent", () => {
    const prompt = buildSystemPrompt()

    expect(prompt).toBe(LOGO_DESIGNER_SYSTEM_PROMPT)
    expect(prompt).not.toContain("## User-mentioned logo versions")
  })

  it("includes mention header and entries when mentionedSection is provided", () => {
    const mentionedSection = [
      "## User-mentioned logo versions",
      "- #1 v1 (versionId: ver-1)",
      "- #2 v3 (versionId: ver-2)",
      "- #4 v2 (versionId: ver-3)",
    ].join("\n")

    const prompt = buildSystemPrompt({ mentionedSection })

    expect(prompt).toContain("## User-mentioned logo versions")
    expect(prompt).toContain("- #1 v1 (versionId: ver-1)")
    expect(prompt).toContain("- #2 v3 (versionId: ver-2)")
    expect(prompt).toContain("- #4 v2 (versionId: ver-3)")
  })

  it("contains explicit referencedVersions versionId guidance", () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain("referencedVersions 배열에는 반드시 data-mention part의 versionId 값을 사용한다")
    expect(prompt).toContain("logoId를 넣으면 서버가 폴백하지만")
  })

  it("contains compositional-intent generate_batch preference guidance", () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain("compositional 의도")
    expect(prompt).toContain("generate_batch({ count: 1")
    expect(prompt).toContain("edit_logo(outputMode: \"new_logo\")보다")
  })

  it("contains auto-reference awareness guidance", () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain("최근 두 개 user 턴")
    expect(prompt).toContain("referenceImageUrls로 다시 넘길 필요가 없고")
  })
})