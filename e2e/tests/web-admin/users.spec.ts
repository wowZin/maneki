import { test, expect } from '@playwright/test'
import { loginAdmin } from '../../fixtures/api'

/**
 * P3-1: 用户管理 E2E 测试
 * 测试重点：用户列表页面加载、搜索、表格展示
 */

test.describe('用户管理', () => {
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
    await page.locator('text=用户管理').first().click()
    await expect(page).toHaveURL(/\/users/)
    await page.waitForTimeout(1000)
  })

  test('用户管理页面加载并显示标题', async ({ page }) => {
    await expect(page.locator('h1:has-text("用户管理")')).toBeVisible()
    await expect(page.locator('text=管理平台注册用户、等级与权限')).toBeVisible()
  })

  test('搜索框和筛选条件可见', async ({ page }) => {
    await expect(page.locator('input[placeholder="搜索用户名或手机号"]')).toBeVisible()
    await expect(page.locator('button:has-text("搜索")')).toBeVisible()
    await expect(page.locator('button:has-text("按准确率排名")').or(page.locator('button:has-text("取消准确率排名")'))).toBeVisible()
  })

  test('用户列表表格可见', async ({ page }) => {
    await expect(page.locator('.ant-table')).toBeVisible()
    await expect(page.locator('th:has-text("昵称")')).toBeVisible()
    await expect(page.locator('th:has-text("手机号")')).toBeVisible()
    await expect(page.locator('th:has-text("等级")')).toBeVisible()
    await expect(page.locator('th:has-text("状态")')).toBeVisible()
  })
})
