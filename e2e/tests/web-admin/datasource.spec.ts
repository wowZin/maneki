import { test, expect } from '@playwright/test'
import { loginAdmin } from '../../fixtures/api'

/**
 * P3-3: 数据源管理 E2E 测试
 * 测试重点：数据源管理页面加载、统计卡片、数据分类入口
 */

test.describe('数据源管理', () => {
  let adminToken: string

  test.beforeAll(async ({ request }) => {
    const admin = await loginAdmin(request, 'superadmin', 'SuperPass123!')
    adminToken = admin.token!
  })

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()))
    await page.goto('/login')
    await page.locator('input[placeholder="账户名称"]').fill('superadmin')
    await page.locator('input[placeholder="密码"]').fill('SuperPass123!')
    await page.locator('button:has-text("登 录")').click()
    await expect(page).toHaveURL(/\/$/)
    // 数据源管理是子菜单，直接导航到页面
    await page.goto('/datasource')
    await page.waitForTimeout(1000)
  })

  test('数据源管理页面加载并显示统计卡片', async ({ page }) => {
    await expect(page.locator('text=新闻总数')).toBeVisible()
    await expect(page.locator('text=今日新增')).toBeVisible()
    await expect(page.locator('text=K线记录')).toBeVisible()
    await expect(page.locator('text=数据源状态')).toBeVisible()
  })

  test('数据源分类入口卡片可见', async ({ page }) => {
    await expect(page.locator('text=数据源管理').first()).toBeVisible()
    await expect(page.locator('text=新闻资讯').first()).toBeVisible()
    await expect(page.locator('text=龙虎榜数据').first()).toBeVisible()
    await expect(page.locator('text=龙虎榜机构交易名单').first()).toBeVisible()
    await expect(page.locator('text=游资名录').first()).toBeVisible()
  })
})
