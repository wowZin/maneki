/**
 * Features 区域 - 产品四大核心特性展示
 * 位于 Hero 和 Pricing 之间，增强产品价值感知
 */

import React, { useEffect, useRef, useState } from 'react'
import { RiseOutlined, EyeOutlined, BarChartOutlined, GiftOutlined } from '@ant-design/icons'
import styles from './FeaturesSection.module.css'

interface FeatureItem {
  icon: React.ReactNode
  title: string
  desc: string
  color: string
  gradient: string
}

const FEATURES: FeatureItem[] = [
  {
    icon: <RiseOutlined />,
    title: 'AI 涨停预测',
    desc: '基于深度学习模型，提前捕捉涨停信号，让机会不再错过',
    color: '#e74c3c',
    gradient: 'linear-gradient(135deg, #e74c3c 0%, #f39c12 100%)',
  },
  {
    icon: <EyeOutlined />,
    title: '龙虎榜追踪',
    desc: '实时监控主力资金动向，追踪机构席位，看清市场博弈',
    color: '#3498db',
    gradient: 'linear-gradient(135deg, #3498db 0%, #2ecc71 100%)',
  },
  {
    icon: <BarChartOutlined />,
    title: '智能复盘',
    desc: '每日自动生成交易复盘报告，总结经验、优化策略',
    color: '#9b59b6',
    gradient: 'linear-gradient(135deg, #9b59b6 0%, #e74c3c 100%)',
  },
  {
    icon: <GiftOutlined />,
    title: 'VIP 返佣',
    desc: '会员专享高额返佣计划，投资同时还能持续获得收益',
    color: '#f39c12',
    gradient: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
  },
]

const FeaturesSection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} className={styles.section} aria-label="产品特性">
      <div className={styles.container}>
        <div className={`${styles.header} ${visible ? styles.headerVisible : ''}`}>
          <span className={styles.overline}>核心能力</span>
          <h2 className={styles.title}>为什么选择 Maneki</h2>
          <p className={styles.subtitle}>
            四大智能引擎，全方位赋能您的投资决策
          </p>
        </div>

        <div className={styles.grid}>
          {FEATURES.map((f, idx) => (
            <div
              key={f.title}
              className={`${styles.card} ${visible ? styles.cardVisible : ''}`}
              style={{ transitionDelay: `${0.1 + idx * 0.12}s` }}
            >
              <div
                className={styles.iconWrapper}
                style={{ background: `${f.color}12`, color: f.color }}
              >
                <div
                  className={styles.iconGlow}
                  style={{ background: f.gradient }}
                />
                {f.icon}
              </div>
              <h3 className={styles.cardTitle}>{f.title}</h3>
              <p className={styles.cardDesc}>{f.desc}</p>
              <div className={styles.cardLine} style={{ background: f.gradient }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection
