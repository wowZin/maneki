import { test, expect } from '@playwright/test'
import { loginAdmin } from '../../fixtures/api'

/**
 * P3-2: 返佣规则 E2E 测试
 * 测试重点：返佣规则页面加载、规则表格、新增规则按钮
 */

test.describe('返佣规则', () => {
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
    // 返佣规则在子菜单下，直接导航到页面
    await page.goto('/rebates/rules')
    await page.waitForTimeout(1000)
  })

  test('返佣规则页面加载并显示标题', async ({ page }) => {
    await expect(page.locator('h1:has-text("返佣规则设置")')).toBeVisible()
    await expect(page.locator('text=配置返佣单价、阶梯激励与生效范围')).toBeVisible()
  })

  test('新增规则和刷新按钮可见', async ({ page }) => {
    await expect(page.locator('button:has-text("新增规则")')).toBeVisible()
    await expect(page.locator('button:has-text("刷新")')).toBeVisible()
  })

  test('返佣规则表格列展示正确', async ({ page }) => {
    await expect(page.locator('.ant-table')).toBeVisible()
    await expect(page.locator('th:has-text("规则名称")')).toBeVisible()
    await expect(page.locator('th:has-text("返佣单价")')).toBeVisible()
    await expect(page.locator('th:has-text("适用对象")')).toBeVisible()
    await expect(page.locator('th:has-text("状态")')).toBeVisible()
  })
})
