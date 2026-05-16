import { test, expect } from "@playwright/test"
test("debug login", async ({ page }) => {
  await page.goto("/login")
  
  // Listen to API responses
  page.on("response", async (resp) => {
    if (resp.url().includes("login")) {
      console.log("Login API status:", resp.status())
      console.log("Login API headers:", await resp.allHeaders())
      try {
        const body = await resp.json()
        console.log("Login API body:", JSON.stringify(body).slice(0, 200))
      } catch(e) {}
    }
  })
  
  await page.locator('input[placeholder="账户名称"]').fill("superadmin")
  await page.locator('input[placeholder="密码"]').fill("SuperPass123!")
  await page.locator('button:has-text("登 录")').click()
  
  await page.waitForTimeout(3000)
  console.log("Final URL:", page.url())
  console.log("Cookies:", await page.context().cookies())
})
