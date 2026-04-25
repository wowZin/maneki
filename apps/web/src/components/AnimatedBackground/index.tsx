/**
 * 灵动 CSS 动画背景组件
 * 支持多种变体和减少动态效果模式
 */

import React from 'react'
import styles from './mesh.module.css'

export type AnimationVariant = 'mesh' | 'particles' | 'rain' | 'waves'

interface AnimatedBackgroundProps {
  variant?: AnimationVariant
  reducedMotion?: boolean
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  variant = 'mesh',
  reducedMotion = false,
}) => {
  if (reducedMotion) {
    return (
      <div
        className={styles.background}
        style={{
          background:
            'radial-gradient(ellipse at 20% 30%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(6,182,212,0.12) 0%, transparent 50%), #0f172a',
        }}
      />
    )
  }

  return (
    <div className={styles.background} data-variant={variant}>
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />
      <div className={styles.blob4} />
      <div className={styles.blob5} />
      <div className={styles.gridOverlay} />
    </div>
  )
}

export default AnimatedBackground
