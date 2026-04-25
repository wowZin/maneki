/**
 * Slogan 组件 - 品牌主标题和副标题
 */

import React from 'react'
import styles from './HeroSection.module.css'

const Slogan: React.FC = () => {
  return (
    <div className={styles.sloganContainer}>
      <h1 className={styles.mainTitle}>
        <span className={styles.titleLine}>智能洞察</span>
        <span className={styles.titleLine}>
          <span className={styles.highlight}>涨停先机</span>
        </span>
      </h1>
      <p className={styles.subTitle}>
        AI 驱动的股票分析平台，让每一次决策都更有把握
      </p>
      <div className={styles.badgeRow}>
        <span className={styles.badge}>AI 信号预测</span>
        <span className={styles.badge}>板准确率排名</span>
        <span className={styles.badge}>智能复盘</span>
      </div>
    </div>
  )
}

export default Slogan
