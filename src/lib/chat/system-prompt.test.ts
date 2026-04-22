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

  it("always includes static mention guidance paragraph", () => {
    const prompt = buildSystemPrompt()

    expect(prompt).toContain("data-mention이 포함되면")
    expect(prompt).toContain("edit_logo.referencedVersions")
    expect(prompt).toContain('outputMode는 "new_version"')
    expect(prompt).toContain('outputMode는 "new_logo"')
  })
})
