/**
 * PricingCard - 可复用定价卡片
 * 统一高度、精修间距、清晰层级
 */

import React from 'react'
import { CheckCircleOutlined, StarOutlined } from '@ant-design/icons'
import { MembershipPlan } from '../../services/pricing'
import styles from './PricingCard.module.css'

const TIER_STYLES: Record<string, { color: string; bg: string }> = {
  basic: { color: '#475569', bg: 'rgba(71, 85, 105, 0.08)' },
  vip: { color: '#d97706', bg: 'rgba(217, 119, 6, 0.08)' },
  svip: { color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)' },
}

interface PricingCardProps {
  plan: MembershipPlan
  isCurrent?: boolean
  ctaText?: string
  onCTAClick?: () => void
  unit?: string
  price?: number
  originalPrice?: number
  saveLabel?: string
  discountLabel?: string
  loading?: boolean
}

const PricingCard: React.FC<PricingCardProps> = ({
  plan,
  isCurrent = false,
  ctaText,
  onCTAClick,
  unit = '/月',
  price,
  originalPrice,
  saveLabel,
  discountLabel,
  loading = false,
}) => {
  const tierStyle = TIER_STYLES[plan.tier] || TIER_STYLES.basic
  const isPopular = plan.is_popular
  const isFree = plan.tier === 'basic'
  const displayPrice = price !== undefined ? price : isFree ? 0 : 99
  const highlights = plan.highlights || []
  const features = plan.features || []

  return (
    <div
      className={[
        styles.card,
        isPopular ? styles.popular : '',
        isCurrent ? styles.current : '',
      ].join(' ')}
      style={
        {
          '--tier-color': tierStyle.color,
          '--tier-bg': tierStyle.bg,
        } as React.CSSProperties
      }
    >
      {plan.badge && <div className={styles.badge}>{plan.badge}</div>}

      <div className={styles.header}>
        <div className={styles.icon}>{ICON_MAP[plan.icon] || <StarOutlined />}</div>
        <div className={styles.name}>{plan.name}</div>
        <div className={styles.desc}>{plan.description}</div>
      </div>

      <div className={styles.priceSection}>
        {isFree ? (
          <span className={styles.freePrice}>免费</span>
        ) : (
          <div className={styles.priceWrap}>
            <div className={styles.priceMain}>
              <span className={styles.currency}>¥</span>
              <span className={styles.amount}>{displayPrice}</span>
              <span className={styles.period}>{unit}</span>
            </div>
            <div className={styles.priceMeta}>
              {originalPrice !== undefined && originalPrice > displayPrice && (
                <span className={styles.originalPrice}>
                  ¥{originalPrice}{unit}
                </span>
              )}
              {discountLabel && <span className={styles.discountTag}>{discountLabel}</span>}
              {saveLabel && <span className={styles.saveTag}>{saveLabel}</span>}
            </div>
          </div>
        )}
      </div>

      <div className={styles.highlights}>
        {highlights.length > 0 &&
          highlights.map((h, idx) => (
            <span key={idx} className={styles.highlightTag}>
              {h}
            </span>
          ))}
      </div>

      <div className={styles.divider} />

      <div className={styles.features}>
        {features.map((f, idx) => (
          <div key={idx} className={styles.feature}>
            <CheckCircleOutlined className={styles.featureIcon} />
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
        aria-label={ctaText || (isFree ? '免费使用' : `订阅${plan.name}`)}
      >
        {loading ? (
          <span className={styles.loadingDots}>
            <span />
            <span />
            <span />
          </span>
        ) : (
          ctaText || (isFree ? '免费使用' : `订阅${plan.name}`)
        )}
      </button>
    </div>
  )
}

const ICON_MAP: Record<string, React.ReactNode> = {
  star: <StarOutlined />,
  crown: <StarOutlined />,
  thunderbolt: <StarOutlined />,
}

export default PricingCard
