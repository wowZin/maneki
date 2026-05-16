import { test, expect } from '@playwright/test'
import { registerUser, loginUser } from '../../fixtures/api'

/**
 * P2-2: 通知设置 E2E 测试
 * 测试重点：设置页面加载、通知开关、密码修改表单
 */

test.describe('通知设置', () => {
  let testUser: Awaited<ReturnType<typeof registerUser>>

  test.beforeAll(async ({ request }) => {
    const phone = `138${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`
    try {
      testUser = await registerUser(request, phone, 'TestPass123!', `S${Date.now().toString().slice(-8)}`)
    } catch (err: any) {
      const body = err?.message || ''
      if (body.includes('已存在') || body.includes('already')) {
        testUser = await loginUser(request, phone, 'TestPass123!')
      } else {
        throw err
      }
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.evaluate((authData) => {
      localStorage.setItem('maneki-auth-storage', JSON.stringify({
        token: authData.token,
        user: {
          id: authData.id,
          nickname: authData.nickname,
          phone: authData.phone,
          vip_level: authData.vip_level,
          is_active: true,
          is_superuser: false,
          is_verified: true,
        },
        isAuthenticated: true,
      }))
    }, testUser)
    await page.reload()
    await page.waitForTimeout(800)
  })

  test('设置页面加载并显示标题', async ({ page }) => {
    await expect(page.locator('h1:has-text("设置")')).toBeVisible()
    await expect(page.locator('text=管理账号安全与个性化偏好')).toBeVisible()
  })

  test('通知设置卡片展示各项开关', async ({ page }) => {
    await expect(page.locator('text=通知设置').first()).toBeVisible()
    await expect(page.locator('text=邮件通知').first()).toBeVisible()
    await expect(page.locator('text=短信通知').first()).toBeVisible()
    await expect(page.locator('text=推送通知').first()).toBeVisible()
    await expect(page.locator('text=营销信息').first()).toBeVisible()

    // 验证 Switch 开关存在
    const switches = page.locator('.ant-switch')
    await expect(switches.first()).toBeVisible()
    expect(await switches.count()).toBeGreaterThanOrEqual(4)
  })

  test('密码修改表单展示', async ({ page }) => {
    await expect(page.locator('text=修改密码').or(page.locator('text=设置密码')).first()).toBeVisible()
    await expect(page.locator('input[placeholder="新密码（至少8位）"]')).toBeVisible()
    await expect(page.locator('input[placeholder="确认新密码"]')).toBeVisible()
    await expect(page.locator('button:has-text("修改密码")').or(page.locator('button:has-text("设置密码")')).first()).toBeVisible()
  })

  test('危险区域展示退出登录和注销账号', async ({ page }) => {
    await expect(page.locator('text=危险区域').first()).toBeVisible()
    await expect(page.locator('text=退出登录').first()).toBeVisible()
    await expect(page.locator('text=注销账号').first()).toBeVisible()
  })
})
