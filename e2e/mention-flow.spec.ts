import { test, expect } from "@playwright/test"

// E2E: structured @-mention chips → edit_logo with referencedVersions + outputMode=new_logo
// Skipped by default; set E2E_GOOGLE_TEST_USER (and cooperating auth harness) to enable.
test.describe("chat-logo-mention — mention flow", () => {
  test.skip(!process.env.E2E_GOOGLE_TEST_USER, "requires E2E test user / auth harness")

  test("mention two versions then send → new logo row appears in gallery", async ({ page }) => {
    // Precondition: authenticated session + project with >= 2 logos already generated.
    // The exact auth bootstrap depends on the sibling e2e/admin-insights.spec.ts harness;
    // adapt here once that harness is shared.
    const projectUrl = process.env.E2E_MENTION_PROJECT_URL
    test.skip(!projectUrl, "requires E2E_MENTION_PROJECT_URL pointing at a project with 2+ logos")

    await page.goto(projectUrl!)

    // Baseline gallery count
    const versionCards = page.locator('[id^="logo-version-"]')
    const initialCount = await versionCards.count()
    expect(initialCount).toBeGreaterThanOrEqual(2)

    // Open composer, type "@", pick the first suggestion, repeat
    const textarea = page.getByRole("textbox")
    await textarea.click()
    await textarea.type("@")
    await page.getByRole("option").first().click()

    await textarea.type(" @")
    await page.getByRole("option").nth(1).click()

    // Two chips should be rendered above the textarea
    await expect(page.locator('[data-testid^="mention-chip-"]')).toHaveCount(2)

    // Send the merge instruction
    await textarea.type("두 로고 합쳐줘")
    await textarea.press("Enter")

    // Wait for assistant turn to settle and a brand-new logo card to appear
    await expect(versionCards).toHaveCount(initialCount + 1, { timeout: 120_000 })
  })
})
