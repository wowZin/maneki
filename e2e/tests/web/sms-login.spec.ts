import { test, expect } from '@playwright/test'

/**
 * P4: 短信验证码登录 E2E 测试
 * 测试重点：手机号输入、获取验证码、倒计时、验证码登录、Token 存储、登录后跳转
 */

test.describe('短信验证码登录', () => {
  const TEST_CODE = '123456'

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    // 切换到手机号登录 tab
    await page.locator('.ant-tabs-tab:has-text("手机号登录")').click()
    await page.waitForTimeout(300)
  })

  test('页面展示手机号登录表单', async ({ page }) => {
    await expect(page.locator('input[placeholder="手机号"]')).toBeVisible()
    await expect(page.locator('input[placeholder="验证码"]')).toBeVisible()
    await expect(page.locator('button:has-text("获取验证码")')).toBeVisible()
    await expect(page.locator('button:visible:has-text("登 录")')).toBeVisible()
  })

  test('手机号格式校验', async ({ page }) => {
    // 不输入手机号直接点击登录按钮（提交表单）触发表单校验
    await page.locator('button:visible:has-text("登 录")').click()
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible()

    // 输入无效手机号后点击登录
    await page.locator('input[placeholder="手机号"]').fill('12345678901')
    await page.locator('button:visible:has-text("登 录")').click()
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible()
  })

  test('获取验证码后按钮进入倒计时', async ({ page }) => {
    // 使用不同的手机号避免 Redis 限流冲突
    const phone = `138${Date.now().toString().slice(-8)}`
    await page.locator('input[placeholder="手机号"]').fill(phone)
    await page.locator('button:has-text("获取验证码")').click()

    // 验证出现倒计时文本（如 "60秒后重发"）
    await expect(page.locator('text=/秒后重发/')).toBeVisible()
  })

  test('短信验证码登录成功并跳转首页', async ({ page }) => {
    // 使用不同的手机号避免 Redis 限流冲突
    const phone = `138${(Date.now() + 1).toString().slice(-8)}`
    await page.locator('input[placeholder="手机号"]').fill(phone)

    // 点击获取验证码
    await page.locator('button:has-text("获取验证码")').click()
    await expect(page.locator('text=/秒后重发/')).toBeVisible()

    // 输入验证码
    await page.locator('input[placeholder="验证码"]').fill(TEST_CODE)

    // 点击登录
    await page.locator('button:visible:has-text("登 录")').click()

    // 验证跳转首页
    await expect(page).toHaveURL(/\/$/)

    // 验证 localStorage 中有 token
    const authData = await page.evaluate(() => {
      const raw = localStorage.getItem('maneki-auth-storage')
      return raw ? JSON.parse(raw) : null
    })
    expect(authData).toBeTruthy()
    expect(authData.isAuthenticated).toBe(true)
    expect(authData.token).toBeTruthy()
    expect(authData.user).toBeTruthy()
    expect(authData.user.phone).toBe(phone)
  })

  test('错误验证码显示提示', async ({ page }) => {
    // 使用不同的手机号避免 Redis 限流冲突
    const phone = `138${(Date.now() + 2).toString().slice(-8)}`
    await page.locator('input[placeholder="手机号"]').fill(phone)
    await page.locator('button:has-text("获取验证码")').click()
    await page.waitForTimeout(500)

    // 输入错误验证码
    await page.locator('input[placeholder="验证码"]').fill('000000')
    await page.locator('button:visible:has-text("登 录")').click()

    // 验证出现错误提示（alert 或 error message toast）
    await expect(
      page.locator('.ant-alert-error').or(page.locator('.ant-message-notice-error')).first()
    ).toBeVisible()
  })
})
