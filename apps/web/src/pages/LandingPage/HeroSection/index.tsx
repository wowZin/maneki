/**
 * Hero 区域 - 占视口约 2/3，包含动画背景和 Slogan
 */

import React, { useEffect, useState } from 'react'
import { DownOutlined } from '@ant-design/icons'
import AnimatedBackground from '../../../components/AnimatedBackground'
import Slogan from './Slogan'
import styles from './HeroSection.module.css'

interface HeroSectionProps {
  onScrollToPricing?: () => void
}

const HeroSection: React.FC<HeroSectionProps> = ({ onScrollToPricing }) => {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <section className={styles.hero} aria-label="品牌介绍">
      <AnimatedBackground variant="mesh" reducedMotion={reducedMotion} />

      <div className={styles.content}>
        <Slogan />

        <button
          className={styles.scrollHint}
          onClick={onScrollToPricing}
          aria-label="向下滚动查看定价"
        >
          <DownOutlined className={styles.chevron} />
        </button>
      </div>
    </section>
  )
}

export default HeroSection
