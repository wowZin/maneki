/**
 * Landing Page - 未登录用户首页
 * HeroSection + PricingSection
 */

import React, { useRef } from 'react'
import HeroSection from './HeroSection'
import PricingSection from './PricingSection'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import styles from './LandingPage.module.css'

const LandingPage: React.FC = () => {
  useDocumentTitle('Maneki - 智能股票分析平台')
  const pricingRef = useRef<HTMLDivElement>(null)

  const scrollToPricing = () => {
    pricingRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <main className={styles.landing}>
      <HeroSection onScrollToPricing={scrollToPricing} />
      <div ref={pricingRef} id="pricing">
        <PricingSection />
      </div>
    </main>
  )
}

export default LandingPage
