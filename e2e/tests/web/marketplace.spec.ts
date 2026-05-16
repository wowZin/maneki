import { test, expect } from "@playwright/test"
import { loginAdmin, createAgent } from "../../fixtures/api"

const API_BASE_URL = "http://localhost:8080/api/v1"

interface TestUser {
  id: string
  phone: string
  nickname: string
  token: string
  vip_level: number
}

async function registerUser(
  request: any,
  phone: string,
  password: string,
  nickname: string
): Promise<TestUser> {
  const resp = await request.post(`${API_BASE_URL}/auth/register`, {
    data: { phone, password, confirm_password: password, nickname },
  })
  if (!resp.ok()) {
    const body = await resp.text()
    throw new Error(`注册用户失败: ${resp.status()} ${body}`)
  }
  const result = await resp.json()
  return {
    id: result.user?.id,
    phone,
    nickname,
    token: result.access_token,
    vip_level: result.user?.vip_level || 0,
  }
}

async function loginUser(
  request: any,
  account: string,
  password: string
): Promise<TestUser> {
  const resp = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { account, password },
  })
  if (!resp.ok()) {
    const body = await resp.text()
    throw new Error(`用户登录失败: ${resp.status()} ${body}`)
  }
  const result = await resp.json()
  return {
    id: result.user?.id,
    phone: result.user?.phone,
    nickname: result.user?.nickname,
    token: result.access_token,
    vip_level: result.user?.vip_level || 0,
  }
}

test.describe("Agent 市场", () => {
  let adminToken: string
  let testUser: TestUser
  const testAgentIds: number[] = []
  let freeAgentName: string
  let paidAgentName: string
  let freeAgentId: number
  let paidAgentId: number

  test.beforeAll(async ({ request }) => {
    const admin = await loginAdmin(request, "superadmin", "SuperPass123!")
    adminToken = admin.token!

    freeAgentName = `E2E_Free_Agent_${Date.now()}`
    const freeAgent = await createAgent(request, adminToken, {
      name: freeAgentName,
      description: "E2E 免费测试 Agent",
      type: "technical",
      category: "trend",
      is_active: true,
      is_featured: true,
      is_official: true,
    })
    freeAgentId = freeAgent.id
    testAgentIds.push(freeAgent.id)

    paidAgentName = `E2E_Paid_Agent_${Date.now()}`
    const paidAgent = await createAgent(request, adminToken, {
      name: paidAgentName,
      description: "E2E 付费测试 Agent",
      type: "fundamental",
      category: "volume",
      is_active: true,
      is_featured: false,
      is_official: false,
      price: 99,
      price_type: "monthly",
    })
    paidAgentId = paidAgent.id
    testAgentIds.push(paidAgent.id)

    const phone = `138${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`
    try {
      testUser = await registerUser(request, phone, "TestPass123!", `U${Date.now().toString().slice(-8)}`)
    } catch (err: any) {
      const body = err?.message || ""
      if (body.includes("已存在") || body.includes("already")) {
        testUser = await loginUser(request, phone, "TestPass123!")
      } else {
        throw err
      }
    }
  })

  test.afterAll(async ({ request }) => {
    for (const id of testAgentIds) {
      try {
        await request.delete(`${API_BASE_URL}/admin/agents/${id}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      } catch {}
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.goto("/marketplace", { timeout: 120000 })
    await page.evaluate((authData) => {
      localStorage.setItem("maneki-auth-storage", JSON.stringify(authData))
    }, {
      token: testUser.token,
      user: {
        id: testUser.id,
        nickname: testUser.nickname,
        phone: testUser.phone,
        vip_level: testUser.vip_level,
        is_active: true,
        is_superuser: false,
        is_verified: true,
      },
      isAuthenticated: true,
    })
    await page.reload()
    await page.waitForTimeout(1000)

    await page.waitForTimeout(1000)
  })

  test("市场列表加载并显示 Agent 卡片", async ({ page }) => {
    await expect(page.locator('h3:has-text("Agent 市场")')).toBeVisible()
    await expect(page.locator('span:has-text("发现和订阅优质的预测 Agent")')).toBeVisible()
    await expect(page.locator(".glass-card").first()).toBeVisible()
  })

  test("免费 Agent 详情页展示", async ({ page }) => {
    await page.goto("/marketplace/agents/" + freeAgentId)
    await expect(page.locator("text=" + freeAgentName)).toBeVisible()
    await expect(page.locator("text=官方")).toBeVisible()
  })

  test("Agent 详情页信息展示", async ({ page }) => {
    await page.goto("/marketplace/agents/" + freeAgentId)
    await expect(page.locator("text=返回市场")).toBeVisible()
    await expect(page.locator("text=预测准确率")).toBeVisible()
    await expect(page.locator("text=模型")).toBeVisible()
    await expect(page.locator("text=评分")).toBeVisible()
    await expect(page.locator("text=使用次数")).toBeVisible()
    await expect(page.locator("text=作者")).toBeVisible()
    await expect(page.locator("text=价格")).toBeVisible()
  })

  test("免费 Agent 显示免费订阅按钮", async ({ page }) => {
    await page.goto("/marketplace/agents/" + freeAgentId)
    await expect(page.locator("button:has-text('免费订阅')")).toBeVisible()
  })

  test("付费 Agent 显示价格", async ({ page }) => {
    await page.goto("/marketplace/agents/" + paidAgentId)
    await expect(page.locator("text=¥99 / 月")).toBeVisible()
  })
})
