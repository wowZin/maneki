import { test, expect } from "@playwright/test"

/**
 * P0-1: 002 管理后台登录 E2E 测试
 * 测试重点：账户密码登录、错误提示、Session 过期、跳转首页
 */

test.describe("管理后台登录", () => {
  // 使用已存在的 superadmin 账号进行测试
  const TEST_ADMIN = {
    name: "superadmin",
    password: "SuperPass123!",
  }

  test("账户密码登录成功并跳转首页", async ({ page }) => {
    await page.goto("/login")

    // 验证登录页加载
    await expect(page).toHaveTitle(/Maneki Admin/)
    await expect(page.locator("text=管理后台登录")).toBeVisible()

    // 填写登录表单
    await page.locator("input[placeholder=\"账户名称\"]").fill(TEST_ADMIN.name)
    await page.locator("input[placeholder=\"密码\"]").fill(TEST_ADMIN.password)
    await page.locator("button:has-text(\"登 录\")").click()

    // 等待登录成功，跳转首页
    await expect(page).toHaveURL(/\/$/)

    // 验证概览页面内容
    await expect(page.locator('h1:has-text("概览")')).toBeVisible()
  })

  test("密码错误显示提示", async ({ page }) => {
    await page.goto("/login")

    await page.locator("input[placeholder=\"账户名称\"]").fill(TEST_ADMIN.name)
    await page.locator("input[placeholder=\"密码\"]").fill("WrongPassword!")
    await page.locator("button:has-text(\"登 录\")").click()

    // 验证错误提示
    await expect(page.locator(".ant-message-error")).toContainText("账号或密码错误")

    // 验证仍在登录页
    await expect(page).toHaveURL(/\/login/)
  })

  test("不存在的账号显示提示", async ({ page }) => {
    await page.goto("/login")

    await page.locator("input[placeholder=\"账户名称\"]").fill("not_exist_user_12345")
    await page.locator("input[placeholder=\"密码\"]").fill("AnyPassword123!")
    await page.locator("button:has-text(\"登 录\")").click()

    // 验证错误提示
    await expect(page.locator(".ant-message-error")).toContainText("账号或密码错误")
    await expect(page).toHaveURL(/\/login/)
  })

  test("空表单提交显示校验错误", async ({ page }) => {
    await page.goto("/login")

    await page.locator("button:has-text(\"登 录\")").click()

    // 验证表单校验提示（第一个错误是账户名称）
    await expect(page.locator(".ant-form-item-explain-error").first()).toContainText("请输入账户名称")
  })

  test("Session 过期后访问受保护页面重定向到登录页", async ({ page, context }) => {
    // 先登录
    await page.goto("/login")
    await page.locator("input[placeholder=\"账户名称\"]").fill(TEST_ADMIN.name)
    await page.locator("input[placeholder=\"密码\"]").fill(TEST_ADMIN.password)
    await page.locator("button:has-text(\"登 录\")").click()
    await expect(page).toHaveURL(/\/$/)

    // 清除 cookie 模拟 session 过期
    await context.clearCookies()

    // 刷新页面
    await page.reload()

    // 应该被重定向到登录页
    await expect(page).toHaveURL(/\/login/)
  })

  test("已登录用户访问登录页自动跳转首页", async ({ page }) => {
    // 先登录
    await page.goto("/login")
    await page.locator("input[placeholder=\"账户名称\"]").fill(TEST_ADMIN.name)
    await page.locator("input[placeholder=\"密码\"]").fill(TEST_ADMIN.password)
    await page.locator("button:has-text(\"登 录\")").click()
    await expect(page).toHaveURL(/\/$/)

    // 再次访问登录页
    await page.goto("/login")

    // 应该自动跳转到首页
    await expect(page).toHaveURL(/\/$/)
  })
})
