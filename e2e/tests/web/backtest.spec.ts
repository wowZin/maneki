import { test, expect } from '@playwright/test'
import { loginAdmin, createAgent, loginUser, registerUser, deleteAgent } from '../../fixtures/api'

/**
 * P0-5: 014 Agent 回测 E2E 测试
 * 测试重点：回测表单配置、提交回测、进度展示、结果展示（命中率/收益）、历史记录列表、再次回测
 */

test.describe('Agent 回测', () => {
  let adminToken: string
  let vipUser: Awaited<ReturnType<typeof registerUser>>
  let testAgentId: number

  test.beforeAll(async ({ request }) => {
    // 登录 superadmin
    const admin = await loginAdmin(request, 'superadmin', 'SuperPass123!')
    adminToken = admin.token!

    // 创建测试 Agent
    const agent = await createAgent(request, adminToken, {
      name: `E2E_Bt_${Date.now()}`,
      description: '回测测试专用 Agent',
      type: 'technical',
      category: 'trend',
      is_active: true,
      is_featured: true,
      is_official: true,
    })
    testAgentId = agent.id

    // 创建 VIP 测试用户
    const timestamp = Date.now()
    vipUser = await registerUser(request, `138${String(timestamp).slice(-8)}`, 'TestPass123!', `v${timestamp}`)
  })

  test.afterAll(async ({ request }) => {
    try {
      await deleteAgent(request, adminToken, testAgentId)
    } catch {
      // ignore
    }
  })

  test('非 VIP 用户访问回测页面显示升级提示', async ({ page, request }) => {
    // 创建普通用户并登录
    const normalUser = await registerUser(
      request,
      `137${String(Date.now()).slice(-8)}`,
      'TestPass123!',
      `n${Date.now()}`
    )

    await page.goto('/replay')

    // 注入普通用户登录状态
    await page.evaluate((auth) => {
      localStorage.setItem('maneki-auth-storage', JSON.stringify({
        token: auth.token,
        user: auth.user,
        isAuthenticated: true,
      }))
    }, { token: normalUser.token, user: { id: normalUser.id, nickname: normalUser.nickname, phone: normalUser.phone, vip_level: 0 } })
    await page.reload()

    await page.waitForTimeout(500)

    // 验证 VIP 提示
    await expect(page.locator('text=VIP 专享功能')).toBeVisible()
    await expect(page.locator('text=回测分析功能仅限 VIP 及以上会员使用')).toBeVisible()
  })

  test('VIP 用户回测页面加载并显示表单', async ({ page, request }) => {
    // 注入 VIP 用户登录状态
    await page.goto('/replay')
    await page.evaluate((auth) => {
      localStorage.setItem('maneki-auth-storage', JSON.stringify({
        token: auth.token,
        user: { ...auth.user, vip_level: 2, is_vip: true },
        isAuthenticated: true,
      }))
    }, { token: vipUser.token, user: { id: vipUser.id, nickname: vipUser.nickname, phone: vipUser.phone, vip_level: 2, is_vip: true } })
    await page.reload()

    await page.waitForTimeout(500)

    // 验证页面标题
    await expect(page.locator('h3:has-text("回测分析")')).toBeVisible()

    // 验证表单元素
    await expect(page.locator('text=创建回测')).toBeVisible()
    await expect(page.locator('text=选择 Agent')).toBeVisible()
    await expect(page.locator('text=回测日期范围')).toBeVisible()
    await expect(page.locator('button:has-text("开始回测")')).toBeVisible()

    // 验证回测历史区域
    await expect(page.locator('text=暂无回测记录')).toBeVisible()
  })

  test('VIP 用户提交回测表单验证', async ({ page }) => {
    // 注入 VIP 用户登录状态
    await page.goto('/replay')
    await page.evaluate((auth) => {
      localStorage.setItem('maneki-auth-storage', JSON.stringify({
        token: auth.token,
        user: { ...auth.user, vip_level: 2, is_vip: true },
        isAuthenticated: true,
      }))
    }, { token: vipUser.token, user: { id: vipUser.id, nickname: vipUser.nickname, phone: vipUser.phone, vip_level: 2, is_vip: true } })
    await page.reload()

    await page.waitForTimeout(500)

    // 不填写表单直接提交
    await page.locator('button:has-text("开始回测")').click()

    // 验证表单校验
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible()
  })

  test('回测历史记录展示（无记录时）', async ({ page }) => {
    // 注入 VIP 用户登录状态
    await page.goto('/replay')
    await page.evaluate((auth) => {
      localStorage.setItem('maneki-auth-storage', JSON.stringify({
        token: auth.token,
        user: { ...auth.user, vip_level: 2, is_vip: true },
        isAuthenticated: true,
      }))
    }, { token: vipUser.token, user: { id: vipUser.id, nickname: vipUser.nickname, phone: vipUser.phone, vip_level: 2, is_vip: true } })
    await page.reload()

    await page.waitForTimeout(800)

    // 验证无记录时的空状态
    await expect(page.locator('text=暂无回测记录').or(page.locator('.ant-list-item'))).toBeVisible()
  })
})
