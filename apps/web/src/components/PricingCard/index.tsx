/**
 * 可复用的定价卡片组件
 */

import React from 'react'
import { CheckCircleOutlined, StarOutlined } from '@ant-design/icons'
import { MembershipPlan } from '../../services/pricing'
import styles from './PricingCard.module.css'

const ICON_MAP: Record<string, React.ReactNode> = {
  star: <StarOutlined />,
}

const COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  gold: '#f59e0b',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
}

const GRADIENT_MAP: Record<string, string> = {
  blue: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
  gold: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
  purple: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  cyan: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
}

interface PricingCardProps {
  plan: MembershipPlan
  isCurrent?: boolean
  ctaText?: string
  onCTAClick?: () => void
  unit?: string
  price?: number
  loading?: boolean
}

const PricingCard: React.FC<PricingCardProps> = ({
  plan,
  isCurrent = false,
  ctaText,
  onCTAClick,
  unit = '/月',
  price,
  loading = false,
}) => {
  const color = COLOR_MAP[plan.color] || '#3b82f6'
  const gradient = GRADIENT_MAP[plan.color] || GRADIENT_MAP.blue
  const isPopular = plan.is_popular
  const isFree = plan.tier === 'basic'

  const displayPrice = price !== undefined ? price : (isFree ? 0 : 99)

  return (
    <div
      className={[
        styles.card,
        isPopular ? styles.popular : '',
        isCurrent ? styles.current : '',
      ].join(' ')}
    >
      {plan.badge && <div className={styles.badge}>{plan.badge}</div>}

      <div className={styles.header}>
        <div className={styles.icon} style={{ background: gradient }}>
          {ICON_MAP[plan.icon] || <StarOutlined />}
        </div>
        <div className={styles.name} style={{ color }}>
          {plan.name}
        </div>
        <div className={styles.desc}>{plan.description}</div>
      </div>

      <div className={styles.priceSection}>
        {isFree ? (
          <span className={styles.freePrice}>免费</span>
        ) : (
          <div>
            <span className={styles.currency}>¥</span>
            <span className={styles.amount}>{displayPrice}</span>
            <span className={styles.period}>{unit}</span>
          </div>
        )}
      </div>

      {plan.highlights.length > 0 && !isFree && (
        <div className={styles.highlights}>
          {plan.highlights.map((h, idx) => (
            <span key={idx} className={styles.highlightTag} style={{ color, background: `${color}15` }}>
              {h}
            </span>
          ))}
        </div>
      )}

      <div className={styles.features}>
        {plan.features.map((f, idx) => (
          <div key={idx} className={styles.feature}>
            <CheckCircleOutlined className={styles.featureIcon} style={{ color }} />
            <span>{f}</span>
          </div>
        ))}
      </div>

      <button
        className={[
          styles.button,
          isPopular ? styles.buttonPrimary : styles.buttonSecondary,
          isCurrent ? styles.buttonDisabled : '',
        ].join(' ')}
        onClick={onCTAClick}
        disabled={isCurrent || loading}
        style={isPopular && !isCurrent ? { background: gradient } : {}}
        aria-label={ctaText || (isFree ? '免费使用' : `订阅${plan.name}`)}
      >
        {loading ? (
          <span className={styles.loadingDots}>
            <span /><span /><span />
          </span>
        ) : (
          ctaText || (isFree ? '免费使用' : `订阅${plan.name}`)
        )}
      </button>
    </div>
  )
}

export default PricingCard
