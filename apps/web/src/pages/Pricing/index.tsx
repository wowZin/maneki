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
  message,
  Skeleton,
  Empty,
} from 'antd'
import {
  RocketOutlined,
  SafetyOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../stores/auth'
import { useUserProfileStore } from '../../stores/userProfile'
import {
  pricingApi,
  PricingConfigResponse,
  MembershipPlan,
  BillingCycle,
  MembershipTier,
} from '../../services/pricing'
import PricingCard from '../../components/PricingCard'
import UserStatusBar from './UserStatusBar'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

const { Title, Text, Paragraph } = Typography

const Pricing: React.FC = () => {
  useDocumentTitle('会员定价 - Maneki')
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const { profile } = useUserProfileStore()

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
      if (data.cycles.length > 0) {
        setSelectedCycle(data.cycles[0].cycle)
      }
    } catch (error) {
      message.error('获取定价信息失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 当前用户 tier 映射
  const currentTier = profile?.vip_level ?? 0
  const tierMap: Record<number, MembershipTier> = {
    0: 'basic',
    1: 'vip',
    2: 'svip',
  }
  const currentTierId = tierMap[currentTier] || 'basic'

  // 获取周期信息
  const cycleInfo = pricingData?.cycles.find((c) => c.cycle === selectedCycle)

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
      navigate(`/order/${order.order_id}`)
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建订单失败')
    } finally {
      setSubscribing(null)
    }
  }

  // 生成 CTA 文本
  const getCTAText = (tier: MembershipTier): string => {
    if (tier === currentTierId) return '当前方案'
    if (currentTier >= 2 && tier !== 'basic') return '您已享受全部权益'
    if (tier === 'basic') return '免费使用'
    return '立即升级'
  }

  // 渲染价格卡片
  const renderPricingCard = (plan: MembershipPlan) => {
    const priceDetail = plan.prices[selectedCycle]
    const isCurrent = plan.tier === currentTierId
    const isMaxTier = currentTier >= 2 && plan.tier !== 'basic'

    // 计算展示价格
    let displayPrice = 0
    if (plan.tier !== 'basic' && priceDetail) {
      displayPrice = priceDetail.discounted_price
    }

    return (
      <PricingCard
        plan={plan}
        isCurrent={isCurrent}
        ctaText={getCTAText(plan.tier)}
        onCTAClick={() => {
          if (!isCurrent && !isMaxTier) {
            handleSubscribe(plan.tier)
          }
        }}
        unit={cycleInfo?.unit || '/月'}
        price={displayPrice}
        loading={subscribing === plan.tier}
      />
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
      {/* 用户状态栏（已登录时显示）*/}
      {isAuthenticated && <UserStatusBar onUpgrade={() => {
        const el = document.getElementById('pricing-cards')
        el?.scrollIntoView({ behavior: 'smooth' })
      }} />}

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
      <div id="pricing-cards">
        <Row gutter={[32, 32]} justify="center">
          {pricingData.plans.map((plan) => (
            <Col xs={24} md={8} key={plan.tier}>
              {renderPricingCard(plan)}
            </Col>
          ))}
        </Row>
      </div>

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
