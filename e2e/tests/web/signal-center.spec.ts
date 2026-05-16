import { test, expect } from '@playwright/test'
import { registerUser, loginUser } from '../../fixtures/api'

/**
 * P1-2: 信号中心 E2E 测试
 * 测试重点：信号列表展示、我的统计、今日关注、页面基本结构
 */

test.describe('信号中心', () => {
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
    await page.goto('/signals')
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

  test('页面加载并显示信号列表区域', async ({ page }) => {
    // 信号列表为空时显示"暂无实时信号"，有数据时显示"实时涨停预测"
    await expect(
      page.locator('text=实时涨停预测').or(page.locator('text=暂无实时信号'))
    ).toBeVisible()
  })

  test('我的统计卡片可见并支持周期切换', async ({ page }) => {
    await expect(page.locator('text=我的统计')).toBeVisible()

    // 验证统计指标存在
    await expect(page.locator('text=关注数')).toBeVisible()
    await expect(page.locator('text=命中数')).toBeVisible()
    await expect(page.locator('text=命中率')).toBeVisible()

    // 验证周期切换按钮
    await expect(page.locator('.ant-radio-group:has-text("近7日")')).toBeVisible()
    await expect(page.locator('.ant-radio-group:has-text("近30日")')).toBeVisible()
    await expect(page.locator('.ant-radio-group:has-text("近90日")')).toBeVisible()

    // 点击切换周期
    await page.locator('.ant-radio-group .ant-radio-button-wrapper:has-text("近30日")').first().click()
    await page.waitForTimeout(300)
    await expect(page.locator('.ant-radio-button-wrapper-checked:has-text("近30日")')).toBeVisible()
  })

  test('今日关注卡片可见', async ({ page }) => {
    await expect(page.locator('text=今日关注')).toBeVisible()
  })
})
