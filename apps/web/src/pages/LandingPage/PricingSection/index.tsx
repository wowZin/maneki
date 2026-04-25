/**
 * LandingPage 定价区域
 * 简化展示，CTA 根据认证状态跳转
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Skeleton, Empty, message } from 'antd'
import { CrownOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../../stores/auth'
import { pricingApi, MembershipPlan } from '../../../services/pricing'
import PricingCard from '../../../components/PricingCard'
import styles from './PricingSection.module.css'

const PricingSection: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<MembershipPlan[]>([])

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const data = await pricingApi.getPricingConfig()
      setPlans(data.plans)
    } catch {
      message.error('获取定价信息失败')
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
    <section className={styles.section} aria-label="定价信息">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <CrownOutlined />
          </div>
          <h2 className={styles.title}>选择适合您的方案</h2>
          <p className={styles.subtitle}>
            解锁更多高级功能，获取更精准的涨停预测信号
          </p>
        </div>

        <Row gutter={[24, 24]} justify="center">
          {plans.map((plan) => (
            <Col xs={24} sm={12} lg={8} key={plan.tier}>
              <PricingCard
                plan={plan}
                onCTAClick={handleCTA}
                ctaText={isAuthenticated ? '升级会员' : '立即体验'}
                unit={plan.prices.monthly ? '/月' : ''}
                price={plan.prices.monthly?.discounted_price ?? 0}
              />
            </Col>
          ))}
        </Row>

        <p className={styles.footerNote}>
          所有付费会员均可享受 7 天无理由退款
        </p>
      </div>
    </section>
  )
}

export default PricingSection
