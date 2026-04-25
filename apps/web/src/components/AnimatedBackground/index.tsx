/**
 * 灵动 CSS 动画背景组件
 * 支持多种变体和减少动态效果模式
 */

import React from 'react'
import meshStyles from './mesh.module.css'
import rainbowStyles from './rainbow.module.css'

export type AnimationVariant = 'mesh' | 'particles' | 'rain' | 'waves' | 'rainbow'

interface AnimatedBackgroundProps {
  variant?: AnimationVariant
  reducedMotion?: boolean
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  variant = 'mesh',
  reducedMotion = false,
}) => {
  // 彩虹喜庆主题背景
  if (variant === 'rainbow') {
    if (reducedMotion) {
      return (
        <div
          className={rainbowStyles.background}
          style={{
            background:
              'radial-gradient(ellipse at 20% 30%, rgba(255,200,100,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(255,150,150,0.08) 0%, transparent 50%), linear-gradient(180deg, #FFFBF5 0%, #FFF8F0 100%)',
          }}
        />
      )
    }

    return (
      <div className={rainbowStyles.background} data-variant={variant}>
        <div className={rainbowStyles.blob1} />
        <div className={rainbowStyles.blob2} />
        <div className={rainbowStyles.blob3} />
        <div className={rainbowStyles.blob4} />
        <div className={rainbowStyles.blob5} />
        <div className={rainbowStyles.blob6} />
        <div className={rainbowStyles.particles}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className={rainbowStyles.particle} />
          ))}
        </div>
        <div className={rainbowStyles.gridOverlay} />
      </div>
    )
  }

  // 默认 mesh 主题背景（深色科技风）
  if (reducedMotion) {
    return (
      <div
        className={meshStyles.background}
        style={{
          background:
            'radial-gradient(ellipse at 20% 30%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(6,182,212,0.12) 0%, transparent 50%), #0f172a',
        }}
      />
    )
  }

  return (
    <div className={meshStyles.background} data-variant={variant}>
      <div className={meshStyles.blob1} />
      <div className={meshStyles.blob2} />
      <div className={meshStyles.blob3} />
      <div className={meshStyles.blob4} />
      <div className={meshStyles.blob5} />
      <div className={meshStyles.gridOverlay} />
    </div>
  )
}

export default AnimatedBackground
