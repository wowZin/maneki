/**
 * 仪表盘首页 - 数据概览看板
 */

import React, { useState, useEffect } from 'react'
import { Row, Col, Typography, Space, Tooltip } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import AccuracyTrendChart from './components/AccuracyTrendChart'
import UserTrackingCard from './components/UserTrackingCard'
import UserTrackingDetailModal from './components/UserTrackingDetailModal'
import AgentPerformanceTable from './components/AgentPerformanceTable'
import HotStocksList from './components/HotStocksList'
import RealtimeSignals from './components/RealtimeSignals'

const { Title, Text } = Typography

const Dashboard: React.FC = () => {
  const [lastUpdated, setLastUpdated] = useState<string>('')

  useEffect(() => {
    setLastUpdated(new Date().toLocaleString('zh-CN'))
  }, [])
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [detailDate, setDetailDate] = useState<string | null>(null)

  const handleViewDetail = (date: string) => {
    setDetailDate(date)
    setDetailModalVisible(true)
  }

  const handleCloseDetail = () => {
    setDetailModalVisible(false)
    setDetailDate(null)
  }

  return (
    <div>
      {/* 页面标题 */}
      <div className="page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>数据概览</Title>
          <Text type="secondary">实时监控平台预测能力、Agent 表现与市场信号</Text>
        </div>
        <Tooltip title="页面加载时间">
          <Space style={{ color: '#9ca3af', fontSize: 12 }}>
            <ClockCircleOutlined />
            <span>更新于 {lastUpdated}</span>
          </Space>
        </Tooltip>
      </div>

      {/* 第一行：正确率趋势 + 用户追踪 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <AccuracyTrendChart />
        </Col>
        <Col xs={24} lg={12}>
          <UserTrackingCard onViewDetail={handleViewDetail} />
        </Col>
      </Row>

      {/* 第二行：实时信号 + 热门股票 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <RealtimeSignals />
        </Col>
        <Col xs={24} lg={12}>
          <HotStocksList />
        </Col>
      </Row>

      {/* 第三行：Agent 命中率 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <AgentPerformanceTable />
        </Col>
      </Row>

      {/* 明细弹窗 */}
      <UserTrackingDetailModal
        visible={detailModalVisible}
        date={detailDate}
        onClose={handleCloseDetail}
      />
    </div>
  )
}

export default Dashboard
