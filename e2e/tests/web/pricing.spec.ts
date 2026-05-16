import { test, expect } from '@playwright/test'
import { registerUser, loginUser } from '../../fixtures/api'

/**
 * P2-3: 会员定价与购买 E2E 测试
 * 测试重点：定价页面加载、方案卡片展示、计费周期切换
 */

test.describe('会员定价与购买', () => {
  let testUser: Awaited<ReturnType<typeof registerUser>>

  test.beforeAll(async ({ request }) => {
    const phone = `138${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`
    try {
      testUser = await registerUser(request, phone, 'TestPass123!', `Pr${Date.now().toString().slice(-8)}`)
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
    await page.goto('/pricing')
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

  test('定价页面加载并显示标题', async ({ page }) => {
    await expect(page.locator('h1:has-text("选择适合您的方案")')).toBeVisible()
    await expect(page.locator('text=解锁更多高级功能')).toBeVisible()
  })

  test('展示基础版、VIP、SVIP 三个方案卡片', async ({ page }) => {
    await expect(page.locator('text=基础版').first()).toBeVisible()
    await expect(page.locator('text=VIP会员').first()).toBeVisible()
    await expect(page.locator('text=SVIP会员').first()).toBeVisible()
  })

  test('计费周期切换按钮可见并可点击', async ({ page }) => {
    await expect(page.locator('button:has-text("月付")')).toBeVisible()
    await expect(page.locator('button:has-text("季付")')).toBeVisible()
    await expect(page.locator('button:has-text("年付")')).toBeVisible()

    await page.locator('button:has-text("年付")').click()
    await page.waitForTimeout(300)
  })

  test('方案卡片包含订阅按钮', async ({ page }) => {
    const buttons = page.locator('button:has-text("免费使用"), button:has-text("立即订阅")')
    await expect(buttons.first()).toBeVisible()
    expect(await buttons.count()).toBeGreaterThanOrEqual(3)
  })
})
