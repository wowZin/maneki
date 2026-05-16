import { test, expect } from '@playwright/test'
import { registerUser, loginUser } from '../../fixtures/api'

/**
 * P1-1: 首页概览数据看板 E2E 测试
 * 测试重点：页面标题、正确率趋势图表、实时信号、热门股票、Agent 命中率表格
 */

test.describe('首页概览数据看板', () => {
  let testUser: Awaited<ReturnType<typeof registerUser>>

  test.beforeAll(async ({ request }) => {
    const phone = `138${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`
    try {
      testUser = await registerUser(request, phone, 'TestPass123!', `D${Date.now().toString().slice(-8)}`)
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
    await page.goto('/')
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

  test('页面加载并显示标题与更新时间', async ({ page }) => {
    await expect(page.locator('h3:has-text("数据概览")')).toBeVisible()
    await expect(page.locator('text=实时监控平台预测能力、Agent 表现与市场信号')).toBeVisible()
    await expect(page.locator('text=更新于')).toBeVisible()
  })

  test('正确率趋势图表卡片可见并支持周期切换', async ({ page }) => {
    await expect(page.locator('text=打板预测正确率趋势')).toBeVisible()

    // 限定在正确率趋势卡片内验证周期切换按钮
    const chartCard = page.locator('.ant-card').filter({ hasText: '打板预测正确率趋势' })
    await expect(chartCard.locator('.ant-radio-group')).toBeVisible()
    await expect(chartCard.locator('.ant-radio-button-wrapper:has-text("近7日")')).toBeVisible()
    await expect(chartCard.locator('.ant-radio-button-wrapper:has-text("近30日")')).toBeVisible()
    await expect(chartCard.locator('.ant-radio-button-wrapper:has-text("近90日")')).toBeVisible()
    await expect(chartCard.locator('.ant-radio-button-wrapper:has-text("本年")')).toBeVisible()

    // 点击切换周期
    await chartCard.locator('.ant-radio-button-wrapper:has-text("近30日")').click()
    await page.waitForTimeout(300)
    await expect(chartCard.locator('.ant-radio-button-wrapper-checked:has-text("近30日")')).toBeVisible()
  })

  test('实时信号卡片可见', async ({ page }) => {
    // 使用卡片标题精确匹配，避免与空状态文本冲突
    await expect(page.locator('.ant-card-head-title:has-text("实时信号")')).toBeVisible()
  })

  test('热门股票卡片可见', async ({ page }) => {
    // 使用卡片标题精确匹配，避免与空状态文本冲突
    await expect(page.locator('.ant-card-head-title:has-text("热门股票")')).toBeVisible()
  })

  test('Agent 命中率表格可见并支持周期切换', async ({ page }) => {
    await expect(page.locator('text=Agent 命中率')).toBeVisible()

    // 验证周期切换按钮存在（7d/30d/全部）
    await expect(page.locator('.ant-radio-group:has-text("近7日")').nth(1)).toBeVisible()
    await expect(page.locator('.ant-radio-group:has-text("全部")')).toBeVisible()

    // 点击切换周期
    await page.locator('.ant-radio-group .ant-radio-button-wrapper:has-text("全部")').last().click()
    await page.waitForTimeout(300)
    await expect(page.locator('.ant-radio-button-wrapper-checked:has-text("全部")')).toBeVisible()
  })
})
