/**
 * 会员订阅页面 - 科技感主题
 * 从后端获取定价数据，支持折扣展示
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Typography,
  Row,
  Col,
  Space,
  Tag,
  message,
  Skeleton,
  Empty,
} from 'antd'
import {
  CrownOutlined,
  StarOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
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

const { Title, Text, Paragraph } = Typography

// 图标映射 - 科技感配色
const ICON_MAP: Record<string, React.ReactNode> = {
  star: <StarOutlined />,
  crown: <CrownOutlined />,
  thunderbolt: <ThunderboltOutlined />,
}

// 颜色映射 - 蓝青科技色系
const COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  gold: '#f59e0b',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
}

// 渐变映射 - 科技感渐变
const GRADIENT_MAP: Record<string, string> = {
  blue: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
  gold: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
  purple: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  cyan: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
}

const Pricing: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  // 数据状态
  const [loading, setLoading] = useState(true)
  const [pricingData, setPricingData] = useState<PricingConfigResponse | null>(null)
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('monthly')
  const [subscribing, setSubscribing] = useState<MembershipTier | null>(null)

  // 获取定价配置
  useEffect(() => {
    fetchPricingConfig()
  }, [])

  const fetchPricingConfig = async () => {
    try {
      setLoading(true)
      const data = await pricingApi.getPricingConfig()
      setPricingData(data)
      // 设置默认选中的周期
      if (data.cycles.length > 0) {
        setSelectedCycle(data.cycles[0].cycle)
      }
    } catch (error) {
      message.error('获取定价信息失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 处理订阅
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
      const order = await pricingApi.createOrder({
        tier,
        cycle: selectedCycle,
      })

      message.success('订单创建成功，正在跳转支付...')

      // ============================================
      // TODO: 支付对接 - 根据支付方式跳转
      // ============================================

      // 方案1: 跳转支付宝/微信支付页面
      // if (order.pay_url) {
      //   window.open(order.pay_url, '_blank')
      // }

      // 方案2: 显示支付二维码弹窗
      // setQrCodeUrl(order.qr_code_url)
      // setShowPayModal(true)

      // 方案3: 微信内支付 (JSAPI)
      // if (isWechat) {
      //   wx.chooseWXPay({
      //     timestamp: order.pay_config.timestamp,
      //     nonceStr: order.pay_config.nonceStr,
      //     package: order.pay_config.package,
      //     signType: 'RSA',
      //     paySign: order.pay_config.paySign,
      //   })
      // }

      // 方案4: 跳转订单详情页等待支付
      navigate(`/order/${order.order_id}`)
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建订单失败')
    } finally {
      setSubscribing(null)
    }
  }

  // 格式化价格
  const formatPrice = (price: number) => {
    return price.toFixed(0)
  }

  // 渲染价格区域（支持折扣显示）
  const renderPriceSection = (plan: MembershipPlan) => {
    const priceDetail = plan.prices[selectedCycle]
    const cycleInfo = pricingData?.cycles.find((c) => c.cycle === selectedCycle)

    if (!priceDetail || !cycleInfo) return null

    const {
      original_price,
      discounted_price,
      discount_rate,
      discount_label,
      save_amount,
    } = priceDetail

    const hasDiscount = discount_rate < 1.0 && discounted_price < original_price

    // 免费会员
    if (plan.tier === 'basic') {
      return (
        <div className="pricing-price">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 700, color: '#10b981' }}>
            免费
          </span>
        </div>
      )
    }

    return (
      <div className="pricing-price">
        {/* 折扣标签 */}
        {hasDiscount && discount_label && (
          <div style={{ marginBottom: 12 }}>
            <Tag
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 20,
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                color: 'white',
                border: 'none'
              }}
            >
              {discount_label}
            </Tag>
          </div>
        )}

        <div>
          <span className="pricing-currency">¥</span>
          <span
            className="pricing-amount"
            style={{ color: hasDiscount ? '#ef4444' : 'var(--text-primary)' }}
          >
            {formatPrice(discounted_price)}
          </span>
          <span className="pricing-period">{cycleInfo.unit}</span>
        </div>

        {/* 原价和节省金额 */}
        <div style={{ marginTop: 12, minHeight: 24 }}>
          {hasDiscount ? (
            <Space size={12}>
              <Text style={{ fontSize: 15, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>
                ¥{formatPrice(original_price)}
              </Text>
              {save_amount > 0 && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '4px 10px',
                    borderRadius: 12
                  }}
                >
                  省¥{formatPrice(save_amount)}
                </span>
              )}
            </Space>
          ) : (
            <Text style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              原价 ¥{formatPrice(original_price)}
            </Text>
          )}
        </div>
      </div>
    )
  }

  // 渲染价格卡片
  const renderPricingCard = (plan: MembershipPlan) => {
    const icon = ICON_MAP[plan.icon] || <StarOutlined />
    const color = COLOR_MAP[plan.color] || '#3b82f6'
    const gradient = GRADIENT_MAP[plan.color] || GRADIENT_MAP.blue
    const isPopular = plan.is_popular
    const isFree = plan.tier === 'basic'

    return (
      <div
        className={isPopular ? 'pricing-card pricing-card-popular' : 'pricing-card'}
        style={{
          transform: isPopular ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        {/* 徽章 */}
        {plan.badge && (
          <div className="pricing-badge">
            {plan.badge}
          </div>
        )}

        {/* 头部图标和名称 */}
        <div
          className="pricing-icon"
          style={{ background: gradient }}
        >
          {icon}
        </div>
        <div
          className="pricing-name"
          style={{ color }}
        >
          {plan.name}
        </div>
        <div className="pricing-desc">{plan.description}</div>

        {/* 价格区域 */}
        {renderPriceSection(plan)}

        {/* 功能亮点 */}
        {!isFree && plan.highlights.length > 0 && (
          <div style={{ marginBottom: 20, textAlign: 'center' }}>
            <Space wrap size={8}>
              {plan.highlights.map((highlight, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: 20,
                    background: `${color}15`,
                    color: color,
                  }}
                >
                  {highlight}
                </span>
              ))}
            </Space>
          </div>
        )}

        {/* 功能列表 */}
        <div className="pricing-features">
          {plan.features.map((feature, idx) => (
            <div key={idx} className="pricing-feature">
              <CheckCircleOutlined className="pricing-feature-icon" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <button
          className={isPopular ? 'pricing-button pricing-button-primary' : 'pricing-button pricing-button-secondary'}
          onClick={() => handleSubscribe(plan.tier)}
          disabled={subscribing === plan.tier}
          style={isPopular ? { background: gradient } : {}}
        >
          {subscribing === plan.tier ? (
            <span className="tech-loading">
              <span className="tech-loading-dot" style={{ width: 8, height: 8 }} />
              <span className="tech-loading-dot" style={{ width: 8, height: 8 }} />
              <span className="tech-loading-dot" style={{ width: 8, height: 8 }} />
            </span>
          ) : (
            isFree ? '免费使用' : `订阅${plan.name}`
          )}
        </button>
      </div>
    )
  }

  // 渲染周期选择按钮
  const renderCycleButtons = () => {
    if (!pricingData) return null

    return (
      <div className="cycle-toggle">
        {pricingData.cycles.map((cycle) => {
          const isSelected = selectedCycle === cycle.cycle
          return (
            <button
              key={cycle.cycle}
              className={isSelected ? 'cycle-button cycle-button-active' : 'cycle-button'}
              onClick={() => setSelectedCycle(cycle.cycle)}
            >
              {cycle.label}
            </button>
          )
        })}
      </div>
    )
  }

  // 全局折扣提示
  const renderGlobalDiscount = () => {
    if (!pricingData?.global_discount) return null

    return (
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
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: 1200, margin: '0 auto' }}>
        <Skeleton active paragraph={{ rows: 4 }} />
        <Row gutter={[32, 32]} style={{ marginTop: 48 }}>
          {[1, 2, 3].map((i) => (
            <Col xs={24} md={8} key={i}>
              <div className="glass-card" style={{ height: 500 }} />
            </Col>
          ))}
        </Row>
      </div>
    )
  }

  if (!pricingData || pricingData.plans.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <Empty
          description="暂无定价信息"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 20px 60px', maxWidth: 1200, margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Title
          level={1}
          style={{
            marginBottom: 16,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 5vw, 40px)',
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          选择适合您的方案
        </Title>
        <Paragraph style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto' }}>
          解锁更多高级功能，获取更精准的涨停预测信号
          <br />
          所有付费会员均可享受 7 天无理由退款
        </Paragraph>
      </div>

      {/* 全局折扣提示 */}
      {renderGlobalDiscount()}

      {/* 计费周期切换 */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        {renderCycleButtons()}
      </div>

      {/* 价格卡片 */}
      <Row gutter={[32, 32]} justify="center">
        {pricingData.plans.map((plan) => (
          <Col xs={24} md={8} key={plan.tier}>
            {renderPricingCard(plan)}
          </Col>
        ))}
      </Row>

      {/* 底部说明 */}
      <div style={{ marginTop: 80 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Title
            level={3}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              color: 'var(--text-primary)'
            }}
          >
            常见问题
          </Title>
        </div>

        <Row gutter={[24, 24]} justify="center">
          <Col xs={24} md={8}>
            <div className="glass-card glass-card-hover" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.25))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: 24,
                color: '#10b981'
              }}>
                <SafetyOutlined />
              </div>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 16 }}>
                安全支付
              </Text>
              <Text style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                支持支付宝、微信支付，银行级安全加密
              </Text>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div className="glass-card glass-card-hover" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.25))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: 24,
                color: '#3b82f6'
              }}>
                <RocketOutlined />
              </div>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 16 }}>
                7天无理由退款
              </Text>
              <Text style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                购买后7天内不满意可申请全额退款
              </Text>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div className="glass-card glass-card-hover" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.25))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: 24,
                color: '#8b5cf6'
              }}>
                <SyncOutlined />
              </div>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 16 }}>
                灵活升级
              </Text>
              <Text style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                随时升级或降级会员，按比例计算差价
              </Text>
            </div>
          </Col>
        </Row>

        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <Paragraph style={{ color: 'var(--text-secondary)' }}>
            企业用户或需要定制服务？
            <Button type="link" style={{ fontWeight: 600, color: '#3b82f6' }}>联系商务</Button>
          </Paragraph>
          <Text style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            最终解释权归 Maneki 所有 | 价格如有调整，以支付页面为准
          </Text>
        </div>
      </div>
    </div>
  )
}

export default Pricing
