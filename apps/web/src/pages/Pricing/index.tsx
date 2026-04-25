/**
 * 会员订阅页面 - 精修定价布局
 * CSS Grid 替代 Ant Design Row/Col，卡片更宽更舒展
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Skeleton, Empty, message } from 'antd'
import {
  RocketOutlined,
  SafetyOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../stores/auth'
import {
  pricingApi,
  PricingConfigResponse,
  MembershipPlan,
  BillingCycle,
  MembershipTier,
} from '../../services/pricing'
import PricingCard from '../../components/PricingCard'
import styles from './Pricing.module.css'

// 默认定价方案（API 异常时展示）
const DEFAULT_PLANS: MembershipPlan[] = [
  {
    tier: 'basic',
    name: '基础版',
    description: '适合个人投资者入门使用',
    icon: 'star',
    color: 'blue',
    features: ['每日涨停预测信号', '基础股票筛选', 'limited 回测功能', '社区讨论访问'],
    highlights: ['免费使用'],
    prices: {
      monthly: { original_price: 0, discounted_price: 0, discount_rate: 1, discount_label: '', save_amount: 0 },
      quarterly: { original_price: 0, discounted_price: 0, discount_rate: 1, discount_label: '', save_amount: 0 },
      yearly: { original_price: 0, discounted_price: 0, discount_rate: 1, discount_label: '', save_amount: 0 },
    },
    is_popular: false,
  },
  {
    tier: 'vip',
    name: 'VIP会员',
    description: '解锁全部高级分析功能',
    icon: 'crown',
    color: 'gold',
    badge: '最受欢迎',
    features: ['全部基础版功能', '实时涨停信号推送', 'AI 智能选股策略', '无限回测分析', '龙虎榜资金流向', '游资动向追踪', '专属客服支持'],
    highlights: ['实时推送', 'AI选股'],
    prices: {
      monthly: { original_price: 99, discounted_price: 99, discount_rate: 1, discount_label: '', save_amount: 0 },
      quarterly: { original_price: 297, discounted_price: 249, discount_rate: 0.84, discount_label: '84折', save_amount: 48 },
      yearly: { original_price: 1188, discounted_price: 799, discount_rate: 0.67, discount_label: '67折', save_amount: 389 },
    },
    is_popular: true,
  },
  {
    tier: 'svip',
    name: 'SVIP会员',
    description: '机构级专业分析工具',
    icon: 'thunderbolt',
    color: 'purple',
    features: ['全部VIP功能', '机构专用策略模型', '大宗交易监控', '主力资金流向分析', '产业链关联分析', '1对1投资顾问', 'API接口访问', '优先体验新功能'],
    highlights: ['机构策略', '1对1顾问'],
    prices: {
      monthly: { original_price: 299, discounted_price: 299, discount_rate: 1, discount_label: '', save_amount: 0 },
      quarterly: { original_price: 897, discounted_price: 749, discount_rate: 0.83, discount_label: '83折', save_amount: 148 },
      yearly: { original_price: 3588, discounted_price: 2399, discount_rate: 0.67, discount_label: '67折', save_amount: 1189 },
    },
    is_popular: false,
  },
]

const DEFAULT_CYCLES: PricingConfigResponse['cycles'] = [
  { cycle: 'monthly', label: '月付', unit: '/月', months: 1 },
  { cycle: 'quarterly', label: '季付', unit: '/季', months: 3 },
  { cycle: 'yearly', label: '年付', unit: '/年', months: 12 },
]

const PERIOD_UNITS: Record<BillingCycle, string> = {
  monthly: '/月',
  quarterly: '/季',
  yearly: '/年',
}

const Pricing: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [pricingData, setPricingData] = useState<PricingConfigResponse | null>(null)
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('monthly')
  const [subscribing, setSubscribing] = useState<MembershipTier | null>(null)

  useEffect(() => {
    fetchPricingConfig()
  }, [])

  const fetchPricingConfig = async () => {
    try {
      setLoading(true)
      const data = await pricingApi.getPricingConfig()
      if (!data || !Array.isArray(data.plans) || !Array.isArray(data.cycles)) {
        message.error('定价数据格式异常，使用默认配置')
        setPricingData({ plans: DEFAULT_PLANS, cycles: DEFAULT_CYCLES })
        return
      }
      setPricingData(data)
      if (data.cycles.length > 0) {
        setSelectedCycle(data.cycles[0].cycle)
      }
    } catch (error) {
      message.error('获取定价信息失败，使用默认配置')
      setPricingData({ plans: DEFAULT_PLANS, cycles: DEFAULT_CYCLES })
    } finally {
      setLoading(false)
    }
  }

  const getPriceInfo = (plan: MembershipPlan) => {
    const prices = plan.prices || {}
    return prices[selectedCycle] || prices.monthly || { original_price: 0, discounted_price: 0, discount_rate: 1, discount_label: '', save_amount: 0 }
  }

  const getSaveLabel = (plan: MembershipPlan): string => {
    const p = getPriceInfo(plan)
    if (p.save_amount <= 0) return ''
    return `省¥${p.save_amount.toFixed(0)}`
  }

  const handleSubscribe = async (tier: MembershipTier) => {
    if (!isAuthenticated) {
      message.info('请先登录')
      navigate('/login', { state: { from: '/pricing' } })
      return
    }
    if (tier === 'basic') {
      navigate('/')
      return
    }
    setSubscribing(tier)
    try {
      const order = await pricingApi.createOrder({ tier, cycle: selectedCycle })
      message.success('订单创建成功，正在跳转支付...')
      navigate(`/order/${order.order_id}`)
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建订单失败')
    } finally {
      setSubscribing(null)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <Skeleton active paragraph={{ rows: 4 }} />
          <div className={styles.pricingGrid} style={{ marginTop: 48 }}>
            {[1, 2, 3].map((i) => (
              <div className={styles.skeletonCard} key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!pricingData || !Array.isArray(pricingData.plans) || pricingData.plans.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <Empty description="暂无定价信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* 页面标题 */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>选择适合您的方案</h1>
          <p className={styles.pageSubtitle}>
            解锁更多高级功能，获取更精准的涨停预测信号
            <br />
            所有付费会员均可享受 7 天无理由退款
          </p>
        </div>

        {/* 全局折扣提示 */}
        {pricingData.global_discount && (
          <div className={styles.discountBanner}>
            <span className={styles.discountEmoji}>🎉</span>
            <span className={styles.discountLabel}>
              {pricingData.global_discount.label} 限时优惠中
            </span>
            <span className={styles.discountDate}>
              截止 {new Date(pricingData.global_discount.valid_until).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* 计费周期切换 */}
        {pricingData.cycles && pricingData.cycles.length > 0 && (
          <div className={styles.cycleToggleWrap}>
            <div className={styles.cycleToggle}>
              {pricingData.cycles.map((cycle) => {
                const isSelected = selectedCycle === cycle.cycle
                return (
                  <button
                    key={cycle.cycle}
                    className={`${styles.cycleBtn} ${isSelected ? styles.cycleBtnActive : ''}`}
                    onClick={() => setSelectedCycle(cycle.cycle)}
                  >
                    {cycle.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 价格卡片 */}
        <div className={styles.pricingGrid}>
          {pricingData.plans.filter((p) => p && p.tier).map((plan) => {
            const priceInfo = getPriceInfo(plan)
            return (
              <PricingCard
                key={plan.tier}
                plan={plan}
                onCTAClick={() => handleSubscribe(plan.tier)}
                ctaText={plan.tier === 'basic' ? '免费使用' : '立即订阅'}
                unit={PERIOD_UNITS[selectedCycle]}
                price={priceInfo.discounted_price}
                originalPrice={priceInfo.original_price > 0 ? priceInfo.original_price : undefined}
                saveLabel={getSaveLabel(plan)}
                discountLabel={priceInfo.discount_label}
                loading={subscribing === plan.tier}
              />
            )
          })}
        </div>

        {/* 底部 FAQ */}
        <div className={styles.faqSection}>
          <h3 className={styles.faqTitle}>常见问题</h3>
          <div className={styles.faqGrid}>
            <div className={styles.faqCard}>
              <div className={styles.faqIcon} style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
                <SafetyOutlined />
              </div>
              <div className={styles.faqCardTitle}>安全支付</div>
              <div className={styles.faqCardDesc}>支持支付宝、微信支付，银行级安全加密</div>
            </div>
            <div className={styles.faqCard}>
              <div className={styles.faqIcon} style={{ background: 'rgba(217,119,6,0.1)', color: '#d97706' }}>
                <RocketOutlined />
              </div>
              <div className={styles.faqCardTitle}>7天无理由退款</div>
              <div className={styles.faqCardDesc}>购买后7天内不满意可申请全额退款</div>
            </div>
            <div className={styles.faqCard}>
              <div className={styles.faqIcon} style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>
                <SyncOutlined />
              </div>
              <div className={styles.faqCardTitle}>灵活升级</div>
              <div className={styles.faqCardDesc}>随时升级或降级会员，按比例计算差价</div>
            </div>
          </div>
        </div>

        {/* 底部说明 */}
        <div className={styles.footer}>
          <p>企业用户或需要定制服务？<a href="#" className={styles.footerLink}>联系商务</a></p>
          <p className={styles.footerLegal}>最终解释权归 Maneki 所有 | 价格如有调整，以支付页面为准</p>
        </div>
      </div>
    </div>
  )
}

export default Pricing
