import { test, expect } from '@playwright/test'

/**
 * P0-2: 009 灵动欢迎页 Landing Page E2E 测试
 * 测试重点：页面加载、Hero 区域、特性介绍、Pricing 区域、CTA 按钮跳转登录
 */

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('页面加载并显示正确标题', async ({ page }) => {
    await expect(page).toHaveTitle(/Maneki/)
    // 页面标题通过 document.title 设置，内容是 Slogan 中的主标题
    await expect(page.locator('text=招财进宝')).toBeVisible()
    await expect(page.locator('text=智赢先机')).toBeVisible()
  })

  test('Hero 区域展示品牌和 Slogan', async ({ page }) => {
    // 验证品牌主标题
    await expect(page.locator('h1')).toContainText('招财进宝')
    await expect(page.locator('h1')).toContainText('智赢先机')

    // 验证副标题
    await expect(page.locator('text=AI 驱动的股票分析平台')).toBeVisible()

    // 验证 CTA 按钮
    await expect(page.locator('button:has-text("立即开赚")')).toBeVisible()
    await expect(page.locator('button:has-text("了解会员")')).toBeVisible()
  })

  test('点击"立即开赚"跳转到登录页', async ({ page }) => {
    await page.locator('button:has-text("立即开赚")').click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('特性介绍区域展示四大核心能力', async ({ page }) => {
    // 滚动到特性区域并等待动画
    await page.locator('text=为什么选择 Maneki').scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)

    // 验证四个特性卡片（使用 section 内更精确的选择器）
    const featuresSection = page.locator('section[aria-label="产品特性"]')
    await expect(featuresSection.locator('text=AI 涨停预测')).toBeVisible()
    await expect(featuresSection.locator('text=龙虎榜追踪')).toBeVisible()
    await expect(featuresSection.locator('text=智能复盘')).toBeVisible()
    await expect(featuresSection.locator('text=VIP 返佣')).toBeVisible()
  })

  test('Pricing 区域展示会员方案', async ({ page }) => {
    // 点击"了解会员"或直接滚动到 pricing 区域
    await page.locator('button:has-text("了解会员")').click()

    // 等待滚动动画和 API 加载
    await page.waitForTimeout(2000)

    // 验证定价区域标题
    await expect(page.locator('text=选择适合您的方案')).toBeVisible()

    // 验证三个会员等级（使用更长的超时等待 API 加载）
    // API 返回: 基础版, VIP会员, SVIP会员
    const pricingSection = page.locator('section[aria-label="定价信息"]')
    await expect(pricingSection.locator('text=基础版').or(pricingSection.locator('text=免费版')).first()).toBeVisible({ timeout: 10000 })
    await expect(pricingSection.locator('text=VIP会员').or(pricingSection.locator('text=VIP 会员')).first()).toBeVisible({ timeout: 10000 })
    await expect(pricingSection.locator('text=SVIP会员').or(pricingSection.locator('text=SVIP 会员')).first()).toBeVisible({ timeout: 10000 })

    // 验证周期切换按钮
    await expect(page.locator('button:has-text("月付")')).toBeVisible()
    await expect(page.locator('button:has-text("季付")')).toBeVisible()
    await expect(page.locator('button:has-text("年付")')).toBeVisible()
  })

  test('Pricing 区域 CTA 按钮跳转登录页', async ({ page }) => {
    // 滚动到 pricing 区域
    await page.evaluate(() => {
      document.getElementById('pricing')?.scrollIntoView()
    })
    await page.waitForTimeout(500)

    // 点击第一个 CTA 按钮（免费版的"立即体验"）
    const ctaButtons = page.locator('button:has-text("立即体验")')
    await ctaButtons.first().click()

    await expect(page).toHaveURL(/\/login/)
  })

  test('页面整体结构和关键元素可见性', async ({ page }) => {
    // Hero 区域
    await expect(page.locator('section[aria-label="品牌介绍"]')).toBeVisible()

    // 特性区域
    await expect(page.locator('section[aria-label="产品特性"]')).toBeVisible()

    // Pricing 区域
    await expect(page.locator('section[aria-label="定价信息"]')).toBeVisible()
  })
})
