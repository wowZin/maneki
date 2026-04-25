/**
 * Landing Page - 未登录用户首页
 * HeroSection + FeaturesSection + PricingSection
 */

import React, { useRef } from 'react'
import HeroSection from './HeroSection'
import FeaturesSection from './FeaturesSection'
import PricingSection from './PricingSection'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import styles from './LandingPage.module.css'

const LandingPage: React.FC = () => {
  useDocumentTitle('Maneki - 招财智能股票分析')
  const pricingRef = useRef<HTMLDivElement>(null)

  const scrollToPricing = () => {
    pricingRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <main className={styles.landing}>
      <HeroSection onScrollToPricing={scrollToPricing} />
      <FeaturesSection />
      <div ref={pricingRef} id="pricing">
        <PricingSection />
      </div>
    </main>
  )
}

export default LandingPage
