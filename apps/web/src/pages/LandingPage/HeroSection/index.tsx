/**
 * Hero 区域 - 占满视口，包含彩虹动画背景和 Slogan
 */

import React, { useEffect, useState } from 'react'
import { DownOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import AnimatedBackground from '../../../components/AnimatedBackground'
import Slogan from './Slogan'
import styles from './HeroSection.module.css'

interface HeroSectionProps {
  onScrollToPricing?: () => void
}

const HeroSection: React.FC<HeroSectionProps> = ({ onScrollToPricing }) => {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // 首屏内容入场动画
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <section className={styles.hero} aria-label="品牌介绍">
      <AnimatedBackground variant="rainbow" reducedMotion={reducedMotion} />

      {/* 装饰性浮动元素 */}
      <div className={`${styles.decorCircle} ${styles.decor1}`} />
      <div className={`${styles.decorCircle} ${styles.decor2}`} />
      <div className={`${styles.decorCircle} ${styles.decor3}`} />

      <div className={styles.content}>
        <Slogan visible={isVisible} />

        <div className={`${styles.ctaRow} ${isVisible ? styles.ctaRowVisible : ''}`}>
          <button
            className={styles.ctaPrimary}
            onClick={() => navigate('/login')}
            aria-label="立即开始赚钱"
          >
            立即开赚
          </button>
          <button
            className={styles.ctaSecondary}
            onClick={onScrollToPricing}
            aria-label="查看会员方案"
          >
            了解会员
          </button>
        </div>

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
