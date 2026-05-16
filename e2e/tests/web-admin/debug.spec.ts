import { test, expect } from "@playwright/test"
test("debug", async ({ page }) => {
  await page.goto("/login")
  await page.waitForTimeout(5000)
  console.log("title:", await page.title())
})
