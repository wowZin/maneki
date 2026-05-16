import { test, expect } from '@playwright/test'
import { registerUser, loginUser } from '../../fixtures/api'

/**
 * P2-1: 用户个人信息 E2E 测试
 * 测试重点：个人中心页面加载、用户信息展示、会员信息卡片
 */

test.describe('用户个人信息', () => {
  let testUser: Awaited<ReturnType<typeof registerUser>>

  test.beforeAll(async ({ request }) => {
    const phone = `138${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`
    try {
      testUser = await registerUser(request, phone, 'TestPass123!', `P${Date.now().toString().slice(-8)}`)
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
    await page.goto('/profile')
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

  test('个人中心页面加载并显示标题', async ({ page }) => {
    await expect(page.locator('h1:has-text("个人中心")')).toBeVisible()
    await expect(page.locator('text=管理您的账号信息与会员状态')).toBeVisible()
  })

  test('用户信息卡片展示头像、昵称和手机号', async ({ page }) => {
    await expect(page.locator('.ant-avatar').first()).toBeVisible()
    await expect(page.locator(`text=${testUser.nickname}`).first()).toBeVisible()
    await expect(page.locator('text=手机号').first()).toBeVisible()
  })

  test('会员信息卡片可见', async ({ page }) => {
    await expect(page.locator('text=会员信息').first()).toBeVisible()
    await expect(
      page.locator('text=立即升级').or(page.locator('text=升级会员')).first()
    ).toBeVisible()
  })

  test('个人资料表单展示并可进入编辑模式', async ({ page }) => {
    await expect(page.locator('text=个人资料').first()).toBeVisible()
    await expect(page.locator('text=昵称').first()).toBeVisible()
    await expect(page.locator('input[placeholder="昵称"]')).toBeVisible()

    // 点击编辑按钮
    await page.locator('button:has-text("编辑")').first().click()
    await page.waitForTimeout(500)

    // 编辑模式下应显示保存和取消按钮（按钮文本中间有空格）
    await expect(page.locator('button:has-text("保存修改")').first()).toBeVisible()
    await expect(page.locator('button:has-text("取 消")').first()).toBeVisible()
  })
})
