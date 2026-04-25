/**
 * LandingPage 定价区域
 * 支持月/季/年周期切换，CTA 根据认证状态跳转
 */

import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Skeleton, Empty } from 'antd'
import { CrownOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../../stores/auth'
import { pricingApi, MembershipPlan, PriceDetail } from '../../../services/pricing'
import PricingCard from '../../../components/PricingCard'
import styles from './PricingSection.module.css'

type Period = 'monthly' | 'quarterly' | 'yearly'

const PERIOD_LABELS: Record<Period, string> = {
  monthly: '月付',
  quarterly: '季付',
  yearly: '年付',
}

const PERIOD_UNITS: Record<Period, string> = {
  monthly: '/月',
  quarterly: '/季',
  yearly: '/年',
}

// 默认定价方案（API 不可用时展示）
const DEFAULT_PLANS: MembershipPlan[] = [
  {
    tier: 'basic',
    name: '免费版',
    description: '入门体验，基础功能',
    icon: 'star',
    color: 'blue',
    badge: '',
    features: ['每日 3 次 AI 分析', '基础股票行情', '社区浏览'],
    highlights: [],
    prices: {
      monthly: { original_price: 0, discounted_price: 0, discount_rate: 0, discount_label: '', save_amount: 0 },
      quarterly: { original_price: 0, discounted_price: 0, discount_rate: 0, discount_label: '', save_amount: 0 },
      yearly: { original_price: 0, discounted_price: 0, discount_rate: 0, discount_label: '', save_amount: 0 },
    },
  },
  {
    tier: 'vip',
    name: 'VIP 会员',
    description: '涨停信号，抢先一步',
    icon: 'star',
    color: 'gold',
    badge: '最受欢迎',
    is_popular: true,
    features: ['无限 AI 涨停预测', '龙虎榜实时追踪', '智能复盘报告', '专属客服支持'],
    highlights: ['限时 8 折'],
    prices: {
      monthly: { original_price: 99, discounted_price: 79, discount_rate: 0.8, discount_label: '8折', save_amount: 20 },
      quarterly: { original_price: 297, discounted_price: 199, discount_rate: 0.67, discount_label: '6.7折', save_amount: 98 },
      yearly: { original_price: 1188, discounted_price: 699, discount_rate: 0.59, discount_label: '5.9折', save_amount: 489 },
    },
  },
  {
    tier: 'svip',
    name: 'SVIP 会员',
    description: '机构级分析，财富加速',
    icon: 'star',
    color: 'purple',
    badge: '',
    features: ['VIP 全部功能', '机构资金流向', '量化策略模型', '1对1 投资顾问', 'VIP 返佣计划'],
    highlights: ['限时 7 折'],
    prices: {
      monthly: { original_price: 299, discounted_price: 209, discount_rate: 0.7, discount_label: '7折', save_amount: 90 },
      quarterly: { original_price: 897, discounted_price: 499, discount_rate: 0.56, discount_label: '5.6折', save_amount: 398 },
      yearly: { original_price: 3588, discounted_price: 1799, discount_rate: 0.5, discount_label: '5折', save_amount: 1789 },
    },
  },
]

const PricingSection: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [period, setPeriod] = useState<Period>('monthly')
  const sectionRef = useRef<HTMLDivElement>(null)
  const [headerVisible, setHeaderVisible] = useState(true)

  useEffect(() => {
    fetchPlans()
  }, [])

  // 滚动揭示动画
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return

    let observer: IntersectionObserver | null = null

    const setupObserver = () => {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            console.log('[PricingSection] IntersectionObserver triggered')
            setHeaderVisible(true)
            observer?.disconnect()
          }
        },
        { threshold: 0.05 }
      )
      observer.observe(el)
    }

    // 在浏览器完成布局绘制后再检查，避免获取到错误的 rect
    const raf = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0
      console.log('[PricingSection] visibility check:', { top: rect.top, bottom: rect.bottom, height: window.innerHeight, isInViewport })
      if (isInViewport) {
        setHeaderVisible(true)
      } else {
        setupObserver()
      }
    })

    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const data = await pricingApi.getPricingConfig()
      setPlans(data.plans)
    } catch {
      setPlans(DEFAULT_PLANS)
    } finally {
      setLoading(false)
    }
  }

  const handleCTA = () => {
    if (isAuthenticated) {
      navigate('/pricing')
    } else {
      navigate('/login')
    }
  }

  const getPriceInfo = (plan: MembershipPlan): PriceDetail => {
    return plan.prices[period] || plan.prices.monthly
  }

  const getSaveLabel = (plan: MembershipPlan): string => {
    const p = getPriceInfo(plan)
    if (p.save_amount <= 0) return ''
    return `省¥${p.save_amount}`
  }

  if (loading) {
    return (
      <section className={styles.section} aria-label="定价信息">
        <div className={styles.container}>
          <Skeleton active paragraph={{ rows: 2 }} />
          <Row gutter={[24, 24]} style={{ marginTop: 40 }}>
            {[1, 2, 3].map((i) => (
              <Col xs={24} md={8} key={i}>
                <div className={styles.skeletonCard} />
              </Col>
            ))}
          </Row>
        </div>
      </section>
    )
  }

  if (plans.length === 0) {
    return (
      <section className={styles.section} aria-label="定价信息">
        <div className={styles.container}>
          <Empty description="暂无定价信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      </section>
    )
  }

  return (
    <section ref={sectionRef} className={styles.section} aria-label="定价信息">
      <div className={styles.container}>
        <div
          className={styles.header}
          style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className={styles.iconWrapper}>
            <CrownOutlined />
          </div>
          <h2 className={styles.title}>选择适合您的方案</h2>
          <p className={styles.subtitle}>
            解锁更多高级功能，获取更精准的涨停预测信号
          </p>

          <div className={styles.periodToggle}>
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ''}`}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
              >
                {PERIOD_LABELS[p]}
                {p === 'yearly' && <span className={styles.periodSave}>最省</span>}
              </button>
            ))}
          </div>
        </div>

        <Row gutter={[24, 24]} justify="center" align="stretch">
          {plans.map((plan, idx) => {
            const priceInfo = getPriceInfo(plan)
            return (
              <Col
                xs={24}
                sm={12}
                lg={8}
                key={plan.tier}
                style={{
                  display: 'flex',
                  opacity: headerVisible ? 1 : 0,
                  transform: headerVisible ? 'translateY(0)' : 'translateY(30px)',
                  transition: `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${0.15 + idx * 0.1}s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${0.15 + idx * 0.1}s`,
                }}
              >
                <PricingCard
                  plan={plan}
                  onCTAClick={handleCTA}
                  ctaText={isAuthenticated ? '升级会员' : '立即体验'}
                  unit={PERIOD_UNITS[period]}
                  price={priceInfo.discounted_price}
                  originalPrice={priceInfo.original_price > 0 ? priceInfo.original_price : undefined}
                  saveLabel={getSaveLabel(plan)}
                  discountLabel={priceInfo.discount_label}
                />
              </Col>
            )
          })}
        </Row>

        <p
          className={styles.footerNote}
          style={{
            opacity: headerVisible ? 1 : 0,
            transition: 'opacity 0.6s ease 0.5s',
          }}
        >
          所有付费会员均可享受 7 天无理由退款
        </p>
      </div>
    </section>
  )
}

export default PricingSection
