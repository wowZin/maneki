import { test, expect } from "@playwright/test"
import { loginAdmin, createAgent, deleteAgent } from "../../fixtures/api"

test.describe("Agent 管理", () => {
  let adminToken: string
  const testAgentIds: number[] = []
  let agent1Name: string
  let agent2Name: string

  test.beforeAll(async ({ request }) => {
    const admin = await loginAdmin(request, "superadmin", "SuperPass123!")
    adminToken = admin.token!

    agent1Name = `E2E_Test_Agent_${Date.now()}_1`
    const agent1 = await createAgent(request, adminToken, {
      name: agent1Name,
      description: "E2E 测试 Agent 1",
      type: "technical",
      category: "trend",
      is_active: true,
      is_featured: true,
    })
    testAgentIds.push(agent1.id)

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
    await page.goto("/login")
    await page.locator('input[placeholder="账户名称"]').fill("superadmin")
    await page.locator('input[placeholder="密码"]').fill("SuperPass123!")
    await page.locator('button:has-text("登 录")').click()
    await expect(page).toHaveURL(/\/$/)
    await page.locator("text=Agent 管理").first().click()
    await expect(page).toHaveURL(/\/agents/)
  })

  test("Agent 列表加载并显示统计数据", async ({ page }) => {
    await expect(page.locator("h1:has-text(\"Agent 管理\")")).toBeVisible()
    await expect(page.locator("text=Agent 总数")).toBeVisible()
    await expect(page.locator("text=启用 Agent")).toBeVisible()
    await expect(page.locator("text=精选 Agent")).toBeVisible()
    await expect(page.locator("text=总使用次数")).toBeVisible()
    await expect(page.locator("text=Agent 列表")).toBeVisible()
    await expect(page.locator(".ant-table")).toBeVisible()
  })

  test("搜索 Agent 功能", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="搜索名称/描述"]')
    await searchInput.fill(agent1Name)
    await searchInput.press('Enter')
    await page.waitForTimeout(500)
    await expect(page.locator('text=' + agent1Name)).toBeVisible()
  })

  test("创建 Agent 并验证列表更新", async ({ page }) => {
    const agentName = `E2E_New_Agent_${Date.now()}`
    await page.locator('button:has-text("新增 Agent")').click()
    await expect(page).toHaveURL(/\/agents\/create/)
    await page.locator('input[placeholder="例如：趋势跟踪专家"]').fill(agentName)
    await page.locator('textarea[placeholder="简要描述该 Agent 的核心功能和适用场景"]').fill('E2E 自动创建的测试 Agent')
    const typeFormItem = page.locator('.ant-form-item').filter({ hasText: '类型' })
    await typeFormItem.locator('.ant-select').click()
    await page.locator('.ant-select-item:has-text("技术面")').click()
    const categoryFormItem = page.locator('.ant-form-item').filter({ hasText: '分类' })
    await categoryFormItem.locator('.ant-select').click()
    await page.locator('.ant-select-item:has-text("趋势")').click()
    await page.locator('textarea[placeholder="在此输入 Agent 的系统提示词，支持 Markdown 格式..."]').fill('你是一个专业的股票技术分析助手')
    await page.locator('button:has-text("保存")').click()
    await expect(page).toHaveURL(/\/agents/)
    await expect(page.locator('.ant-message-success').filter({ hasText: 'Agent 创建成功' })).toContainText('创建成功')
    await expect(page.locator('text=' + agentName)).toBeVisible()
    const row = page.locator('.ant-table-row').filter({ hasText: agentName })
    const idCell = row.locator('td').first()
    const idText = await idCell.textContent().catch(() => null)
    if (idText) {
      const id = parseInt(idText, 10)
      if (!isNaN(id)) testAgentIds.push(id)
    }
  })

  test("编辑 Agent 信息", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="搜索名称/描述"]')
    await searchInput.fill(agent1Name)
    await searchInput.press('Enter')
    await page.waitForTimeout(500)
    const row = page.locator('.ant-table-row').filter({ hasText: agent1Name })
    await row.locator('button').first().click()
    await expect(page.locator('.ant-modal-title:has-text("编辑 Agent")')).toBeVisible()
    const newDesc = `Updated description ${Date.now()}`
    const descTextarea = page.locator('.ant-modal textarea').first()
    await descTextarea.fill(newDesc)
    await page.locator('.ant-modal-footer button:has-text("确 定")').click()
    await expect(page.locator('.ant-message-success').filter({ hasText: 'Agent 更新成功' })).toContainText('更新成功')
  })

  test("设置/取消精选 Agent", async ({ page }) => {
    const row = page.locator('.ant-table-row').filter({ hasText: agent2Name })
    await row.locator('button:has-text("精选")').first().click()
    await page.locator('.ant-popconfirm').waitFor({ state: 'visible' })
    await page.locator('.ant-popconfirm-buttons button').filter({ hasText: '确 定' }).click()
    await page.waitForTimeout(2000)
    await expect(page.getByText('已设为精选')).toBeVisible()
  })

  test("Agent 详情信息展示", async ({ page }) => {
    await expect(page.locator('th:has-text("Agent")')).toBeVisible()
    await expect(page.locator('th:has-text("类型")')).toBeVisible()
    await expect(page.locator('th:has-text("分类")')).toBeVisible()
    await expect(page.locator('th:has-text("模型")')).toBeVisible()
    await expect(page.locator('th:has-text("状态")')).toBeVisible()
    await expect(page.locator('th:has-text("创建时间")')).toBeVisible()
    await expect(page.locator('th:has-text("操作")')).toBeVisible()
    await expect(page.locator('text=启用').first()).toBeVisible()
    await expect(page.locator('text=精选').first()).toBeVisible()
  })
})
