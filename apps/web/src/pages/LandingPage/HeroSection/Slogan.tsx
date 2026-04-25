/**
 * Slogan 组件 - 品牌主标题和副标题
 * 彩虹喜庆风格，支持入场动画
 */

import React from 'react'
import styles from './HeroSection.module.css'

interface SloganProps {
  visible?: boolean
}

const Slogan: React.FC<SloganProps> = ({ visible = true }) => {
  return (
    <div className={`${styles.sloganContainer} ${visible ? styles.sloganVisible : ''}`}>
      <h1 className={`${styles.mainTitle} ${visible ? styles.titleVisible : ''}`}>
        <span className={styles.titleLine}>
          <span className={styles.rainbowText}>招财进宝</span>
        </span>
        <span className={styles.titleLine}>
          <span className={styles.goldText}>智赢先机</span>
        </span>
      </h1>
      <p className={`${styles.subTitle} ${visible ? styles.subTitleVisible : ''}`}>
        AI 驱动的股票分析平台，让每一次决策都更有把握
        <br />
        涨停信号、龙虎追踪、智能复盘 — 助你财富稳健增长
      </p>
      <div className={`${styles.badgeRow} ${visible ? styles.badgeRowVisible : ''}`}>
        <span className={styles.badge}>AI 涨停预测</span>
        <span className={styles.badge}>龙虎榜追踪</span>
        <span className={styles.badge}>智能复盘</span>
        <span className={styles.badge}>VIP 返佣</span>
      </div>
    </div>
  )
}

export default Slogan
