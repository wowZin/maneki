/**
 * 会员订阅页面 - 精修定价卡片
 * 使用 PricingCard 组件确保与 LandingPage 视觉一致
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Typography,
  Row,
  Col,
  Skeleton,
  Empty,
  message,
} from 'antd'
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

const { Title, Text, Paragraph } = Typography

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
      console.log('[Pricing] API response:', data)
      if (!data || !Array.isArray(data.plans) || !Array.isArray(data.cycles)) {
        console.error('[Pricing] Invalid API response structure:', data)
        message.error('定价数据格式异常，使用默认配置')
        setPricingData({ plans: DEFAULT_PLANS, cycles: DEFAULT_CYCLES })
        return
      }
      setPricingData(data)
      if (data.cycles.length > 0) {
        setSelectedCycle(data.cycles[0].cycle)
      }
    } catch (error) {
      console.error('[Pricing] Failed to fetch pricing config:', error)
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
      <div style={{ padding: '40px 20px', maxWidth: 1280, margin: '0 auto' }}>
        <Skeleton active paragraph={{ rows: 4 }} />
        <Row gutter={[32, 32]} style={{ marginTop: 48 }}>
          {[1, 2, 3].map((i) => (
            <Col xs={24} md={8} key={i}>
              <div className="glass-card" style={{ height: 460 }} />
            </Col>
          ))}
        </Row>
      </div>
    )
  }

  if (!pricingData || !Array.isArray(pricingData.plans) || pricingData.plans.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <Empty description="暂无定价信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 20px 60px', maxWidth: 1280, margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Title
          level={1}
          style={{
            marginBottom: 16,
            fontFamily: "'Noto Serif SC', serif",
            fontSize: 'clamp(28px, 5vw, 40px)',
            color: '#1a1a2e',
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          选择适合您的方案
        </Title>
        <Paragraph style={{ fontSize: 16, color: '#6a6a7a', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
          解锁更多高级功能，获取更精准的涨停预测信号
          <br />
          所有付费会员均可享受 7 天无理由退款
        </Paragraph>
      </div>

      {/* 全局折扣提示 */}
      {pricingData.global_discount && (
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 28px',
              borderRadius: 50,
              background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              boxShadow: '0 4px 20px rgba(245, 158, 11, 0.2)',
            }}
          >
            <span style={{ fontSize: 24 }}>🎉</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#92400e' }}>
              {pricingData.global_discount.label} 限时优惠中
            </span>
            <span style={{ fontSize: 13, color: '#a16207' }}>
              截止 {new Date(pricingData.global_discount.valid_until).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      {/* 计费周期切换 */}
      {pricingData.cycles && pricingData.cycles.length > 0 && (
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(0,0,0,0.03)',
              borderRadius: 12,
              padding: 4,
            }}
          >
            {pricingData.cycles.map((cycle) => {
              const isSelected = selectedCycle === cycle.cycle
              return (
                <button
                  key={cycle.cycle}
                  onClick={() => setSelectedCycle(cycle.cycle)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 10,
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                    background: isSelected ? '#fff' : 'transparent',
                    color: isSelected ? '#1a1a2e' : '#8a8a9a',
                    boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {cycle.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 价格卡片 */}
      <Row gutter={[24, 24]} justify="center" align="stretch">
        {pricingData.plans.filter((p) => p && p.tier).map((plan) => {
          const priceInfo = getPriceInfo(plan)
          return (
            <Col xs={24} md={8} key={plan.tier} style={{ display: 'flex' }}>
              <PricingCard
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
            </Col>
          )
        })}
      </Row>

      {/* 底部说明 */}
      <div style={{ marginTop: 80 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Title
            level={3}
            style={{
              fontFamily: "'Noto Serif SC', serif",
              fontSize: 24,
              color: '#1a1a2e',
              fontWeight: 700,
            }}
          >
            常见问题
          </Title>
        </div>

        <Row gutter={[24, 24]} justify="center">
          <Col xs={24} md={8}>
            <div style={{ padding: 24, textAlign: 'center', borderRadius: 16, background: '#f8f8fa', border: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(5,150,105,0.12), rgba(5,150,105,0.2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: 24, color: '#059669'
              }}>
                <SafetyOutlined />
              </div>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 16, color: '#1a1a2e' }}>
                安全支付
              </Text>
              <Text style={{ color: '#6a6a7a', fontSize: 14 }}>
                支持支付宝、微信支付，银行级安全加密
              </Text>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ padding: 24, textAlign: 'center', borderRadius: 16, background: '#f8f8fa', border: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: 24, color: '#3b82f6'
              }}>
                <RocketOutlined />
              </div>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 16, color: '#1a1a2e' }}>
                7天无理由退款
              </Text>
              <Text style={{ color: '#6a6a7a', fontSize: 14 }}>
                购买后7天内不满意可申请全额退款
              </Text>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ padding: 24, textAlign: 'center', borderRadius: 16, background: '#f8f8fa', border: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(124,58,237,0.2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: 24, color: '#7c3aed'
              }}>
                <SyncOutlined />
              </div>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 16, color: '#1a1a2e' }}>
                灵活升级
              </Text>
              <Text style={{ color: '#6a6a7a', fontSize: 14 }}>
                随时升级或降级会员，按比例计算差价
              </Text>
            </div>
          </Col>
        </Row>

        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <Paragraph style={{ color: '#6a6a7a' }}>
            企业用户或需要定制服务？
            <Button type="link" style={{ fontWeight: 600, color: '#3b82f6' }}>联系商务</Button>
          </Paragraph>
          <Text style={{ fontSize: 12, color: '#9a9aaa' }}>
            最终解释权归 Maneki 所有 | 价格如有调整，以支付页面为准
          </Text>
        </div>
      </div>
    </div>
  )
}

export default Pricing
