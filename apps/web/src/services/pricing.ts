/**
 * 会员定价服务 - 从后端获取定价信息
 */

import { api } from './api'

// 计费周期类型
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly'

// 会员等级类型
export type MembershipTier = 'basic' | 'vip' | 'svip'

// 价格详情
export interface PriceDetail {
  original_price: number      // 原价
  discounted_price: number    // 折扣价
  discount_rate: number       // 折扣率 (0.0 - 1.0)
  discount_label: string      // 折扣标签，如 "8折"
  save_amount: number         // 节省金额
}

// 会员方案
export interface MembershipPlan {
  tier: MembershipTier
  name: string
  description: string
  icon: string
  color: string
  badge?: string              // 标签，如 "最受欢迎"
  features: string[]          // 功能列表
  highlights: string[]        // 功能亮点
  prices: Record<BillingCycle, PriceDetail>
  is_popular?: boolean
}

// 定价配置响应
export interface PricingConfigResponse {
  plans: MembershipPlan[]
  cycles: {
    cycle: BillingCycle
    label: string
    unit: string
    months: number
  }[]
  global_discount?: {
    label: string
    rate: number
    valid_until: string
  }
}

// 创建订单请求
export interface CreateOrderRequest {
  tier: MembershipTier
  cycle: BillingCycle
  coupon_code?: string
}

// 创建订单响应
export interface CreateOrderResponse {
  order_id: string
  tier: MembershipTier
  cycle: BillingCycle
  original_amount: number
  discount_amount: number
  final_amount: number
  pay_url: string             // 支付链接（支付宝/微信）
  expires_at: string          // 订单过期时间
}

// 用户当前会员信息
export interface UserMembership {
  tier: MembershipTier
  status: 'active' | 'expired' | 'cancelled'
  start_date: string
  end_date: string
  auto_renew: boolean
  next_billing_date?: string
}

export const pricingApi = {
  /**
   * 获取定价配置
   */
  getPricingConfig: async (): Promise<PricingConfigResponse> => {
    const response = await api.get('/pricing/config')
    return response.data
  },

  /**
   * 获取当前用户的会员信息
   */
  getUserMembership: async (): Promise<UserMembership | null> => {
    try {
      const response = await api.get('/pricing/membership')
      return response.data
    } catch (error) {
      // 未登录或没有会员信息返回 null
      return null
    }
  },

  /**
   * 创建订阅订单
   * TODO: 支付对接完成后
   * 1. 根据返回的 pay_url 或 qr_code 调起支付
   * 2. 轮询支付状态或等待回调
   * 3. 支付成功后跳转会员中心
   */
  createOrder: async (data: CreateOrderRequest): Promise<CreateOrderResponse> => {
    const response = await api.post('/pricing/order', data)
    return response.data
  },

  /**
   * 验证优惠券
   * TODO: 优惠券系统对接
   * 应用场景:
   * 1. 用户在定价页面输入优惠券码
   * 2. 实时验证优惠券有效性
   * 3. 显示折扣后价格
   * 4. 创建订单时携带 coupon_code
   */
  validateCoupon: async (coupon_code: string, tier: MembershipTier, cycle: BillingCycle): Promise<{
    valid: boolean
    discount_amount: number
    message?: string
  }> => {
    const response = await api.post('/pricing/coupon/validate', {
      coupon_code,
      tier,
      cycle,
    })
    return response.data
  },

  /**
   * 获取支付状态
   * TODO: 支付对接完成后
   * 使用场景:
   * 1. 订单详情页轮询支付状态
   * 2. 支付完成后自动刷新页面
   * 3. 超时未支付提醒
   */
  getPaymentStatus: async (order_id: string): Promise<{
    status: 'pending' | 'paid' | 'failed' | 'cancelled'
    paid_at?: string
  }> => {
    const response = await api.get(`/pricing/order/${order_id}/status`)
    return response.data
  },

  /**
   * 取消订阅（自动续费）
   * TODO: 自动续费对接完成后
   * 使用场景:
   * 1. 会员中心页面关闭自动续费
   * 2. 调用支付宝/微信解约接口
   * 3. 更新本地 auto_renew 状态
   * 注意: 取消自动续费不影响当前会员有效期
   */
  cancelSubscription: async (): Promise<void> => {
    await api.post('/pricing/subscription/cancel')
  },
}

export default pricingApi
