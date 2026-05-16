import { test, expect } from "@playwright/test"
test("debug2", async ({ page }) => {
  await page.goto("/login")
  console.log("url after goto:", page.url())
  await page.waitForTimeout(3000)
  
  const hasInput = await page.locator('input[placeholder="账户名称"]').count() > 0
  console.log("has input:", hasInput)
  
  const hasButton = await page.locator('button:has-text("登 录")').count() > 0
  console.log("has button:", hasButton)
  
  const buttons = await page.locator("button").allTextContents()
  console.log("buttons:", buttons)
})
