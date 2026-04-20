import { expect, test, type Page } from "@playwright/test"
import fs from "node:fs/promises"

const tabs = [
  { key: "overview", label: "개요" },
  { key: "cost", label: "비용" },
  { key: "revenue", label: "수익" },
  { key: "users", label: "사용자" },
  { key: "assets", label: "자료" },
] as const

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

const loginAsAdmin = async (page: Page, baseURL: string | undefined) => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for admin login")
  await page.goto(`${baseURL}/login`)
  await page.getByLabel(/email/i).fill(adminEmail!)
  await page.getByLabel(/password/i).fill(adminPassword!)
  await page.getByRole("button", { name: /log ?in|로그인/i }).click()
  await page.waitForURL(/\/projects|\/admin/, { timeout: 30_000 })
}

test("[T13.1][T11.4] admin can visit tabs, no console errors, screenshot bytes captured", async ({ page, baseURL }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })

  await loginAsAdmin(page, baseURL)
  for (const tab of tabs) {
    await page.goto(`/admin?tab=${tab.key}&period=30`)
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveURL(new RegExp(`tab=${tab.key}`))
    await expect(page.getByRole("tab", { name: tab.label })).toBeVisible()
    const screenshot = await page.screenshot({ fullPage: true })
    expect(screenshot.byteLength).toBeGreaterThan(0)
  }

  expect(consoleErrors).toEqual([])
})

test("[T13.2] tier change updates list and rankings after requery", async ({ page, baseURL }) => {
  await loginAsAdmin(page, baseURL)
  await page.goto("/admin?tab=users&period=30")
  await page.waitForLoadState("networkidle")

  const firstTierSelect = page.locator("select").first()
  test.skip((await firstTierSelect.count()) === 0, "No tier select found; requires seeded user table")

  const beforeRanking = await page.locator("table").nth(1).textContent()
  const currentTier = await firstTierSelect.inputValue()
  const nextTier = currentTier === "pro" ? "enterprise" : "pro"

  await firstTierSelect.selectOption(nextTier)
  await page.waitForLoadState("networkidle")
  await page.reload()
  await page.waitForLoadState("networkidle")

  const afterRanking = await page.locator("table").nth(1).textContent()
  expect(afterRanking).not.toBeNull()
  expect(beforeRanking).not.toBe(afterRanking)
})

test("[T13.3] csv export downloads non-empty file", async ({ page, baseURL }) => {
  await loginAsAdmin(page, baseURL)
  await page.goto("/admin?tab=users&period=30")
  await page.waitForLoadState("networkidle")

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: /csv|내보내기/i }).first().click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^users-\d{8}\.csv$/)

  const downloadPath = await download.path()
  expect(downloadPath).toBeTruthy()
  const content = await fs.readFile(downloadPath!)
  expect(content.byteLength).toBeGreaterThan(0)
})

test("[T13.4] threshold banner visible when seeded threshold condition is met", async ({ page, baseURL }) => {
  await loginAsAdmin(page, baseURL)
  await page.goto("/admin?tab=overview&period=30")
  await page.waitForLoadState("networkidle")

  const banner = page.locator("[role='alert'], .border-red-500, .border-amber-500").first()
  test.skip((await banner.count()) === 0, "Threshold scenario requires seeded high-cost dataset")
  await expect(banner).toBeVisible()
})
