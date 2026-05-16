import { test, expect } from "@playwright/test"
import { loginAdmin, createAgent, deleteAgent } from "../../fixtures/api"

test.describe("Agent 管理 Debug", () => {
  let adminToken: string
  const testAgentIds: number[] = []
  let agent2Name: string

  test.beforeAll(async ({ request }) => {
    const admin = await loginAdmin(request, "superadmin", "SuperPass123!")
    adminToken = admin.token!

    agent2Name = `E2E_Test_Agent_${Date.now()}_2`
    const agent2 = await createAgent(request, adminToken, {
      name: agent2Name,
      description: "E2E 测试 Agent 2",
      type: "fundamental",
      category: "volume",
      is_active: false,
      is_featured: false,
    })
    testAgentIds.push(agent2.id)
  })

  test.afterAll(async ({ request }) => {
    for (const id of testAgentIds) {
      try { await deleteAgent(request, adminToken, id) } catch {}
    }
  })

  test.beforeEach(async ({ page }) => {
    page.on("console", msg => console.log("PAGE LOG:", msg.type(), msg.text()))
    await page.goto("/login")
    await page.locator('input[placeholder="账户名称"]').fill("superadmin")
    await page.locator('input[placeholder="密码"]').fill("SuperPass123!")
    await page.locator('button:has-text("登 录")').click()
    await expect(page).toHaveURL(/\/$/)
    await page.locator("text=Agent 管理").first().click()
    await expect(page).toHaveURL(/\/agents/)
  })

  test("debug 设置/取消精选", async ({ page }) => {
    const row = page.locator('.ant-table-row').filter({ hasText: agent2Name })
    console.log("Clicking 精选 button...")
    await row.locator('button:has-text("精选")').first().click()

    console.log("Waiting for popconfirm...")
    await page.locator('.ant-popconfirm').waitFor({ state: "visible" })

    console.log("Taking screenshot before confirm...")
    await page.screenshot({ path: "/tmp/before_confirm.png", fullPage: true })

    console.log("Clicking 确定 button...")
    await page.locator('.ant-popconfirm .ant-btn-primary').click()

    await page.waitForTimeout(1000)
    console.log("Taking screenshot after confirm...")
    await page.screenshot({ path: "/tmp/after_confirm.png", fullPage: true })

    const html = await page.content()
    require("fs").writeFileSync("/tmp/page_after_confirm.html", html)
    console.log("HTML saved. Contains 已设为精选:", html.includes("已设为精选"))
    console.log("HTML saved. Contains 操作失败:", html.includes("操作失败"))
    console.log("HTML saved. Contains 登录成功:", html.includes("登录成功"))

    await page.waitForTimeout(2000)
    await expect(page.getByText("已设为精选")).toBeVisible()
  })
})
