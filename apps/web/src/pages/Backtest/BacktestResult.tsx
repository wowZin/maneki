import React, { useState } from 'react'
import { Card, Typography, Space, Tag, Row, Col, Table, Button, Statistic } from 'antd'
import {
  TrophyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BarChartOutlined,
  CalendarOutlined,
  DownOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { BacktestResult as BacktestResultType, BacktestDetailItem } from '../../services/backtest'

const { Title, Text } = Typography

interface BacktestResultProps {
  result: BacktestResultType
}

const DayDetailTable: React.FC<{ details: BacktestDetailItem[] }> = ({ details }) => {
  const columns = [
    {
      title: '股票代码',
      dataIndex: 'stock_code',
      key: 'stock_code',
      width: 100,
    },
    {
      title: '股票名称',
      dataIndex: 'stock_name',
      key: 'stock_name',
      width: 120,
    },
    {
      title: '决策',
      dataIndex: 'decision',
      key: 'decision',
      width: 80,
      render: (decision: string) => (
        <Tag color={decision === 'buy' ? 'green' : decision === 'sell' ? 'red' : 'default'}>
          {decision === 'buy' ? '买入' : decision === 'sell' ? '卖出' : '持有'}
        </Tag>
      ),
    },
    {
      title: '分数',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      render: (score: number) => score > 0 ? score.toFixed(2) : '-',
    },
    {
      title: '结果',
      dataIndex: 'actual_hit',
      key: 'actual_hit',
      width: 80,
      render: (hit: boolean) =>
        hit ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>命中</Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />}>未命中</Tag>
        ),
    },
  ]

  return (
    <Table
      columns={columns}
      dataSource={details || []}
      rowKey={(_record: BacktestDetailItem, index?: number) => `${_record.stock_code}-${index ?? 0}`}
      size="small"
      pagination={false}
      locale={{ emptyText: '当日无预测数据' }}
    />
  )
}

const BacktestResult: React.FC<BacktestResultProps> = ({ result }) => {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  const toggleDay = (date: string) => {
    const next = new Set(expandedDays)
    if (next.has(date)) {
      next.delete(date)
    } else {
      next.add(date)
    }
    setExpandedDays(next)
  }

  const hitRatePercent = (result.overall_hit_rate * 100).toFixed(2)

  return (
    <Card className="glass-card">
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>
          <TrophyOutlined style={{ marginRight: 8, color: '#f59e0b' }} />
          回测结果
        </Title>

        {/* 总体统计 */}
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <Statistic
              title="总天数"
              value={result.total_days}
              prefix={<CalendarOutlined />}
            />
          </Col>
          <Col xs={12} md={6}>
            <Statistic
              title="总信号数"
              value={result.total_signals}
              prefix={<BarChartOutlined />}
            />
          </Col>
          <Col xs={12} md={6}>
            <Statistic
              title="命中"
              value={result.total_hit}
              valueStyle={{ color: '#10b981' }}
              prefix={<CheckCircleOutlined />}
            />
          </Col>
          <Col xs={12} md={6}>
            <Statistic
              title="未命中"
              value={result.total_miss}
              valueStyle={{ color: '#ef4444' }}
              prefix={<CloseCircleOutlined />}
            />
          </Col>
        </Row>

        <div style={{ textAlign: 'center', padding: '16px 0', background: '#fff8f0', borderRadius: 12 }}>
          <Text type="secondary" style={{ fontSize: 14 }}>总体命中率</Text>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#e67e22' }}>
            {hitRatePercent}%
          </div>
        </div>

        {/* 按天详情 */}
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Title level={5} style={{ margin: 0 }}>按天详情</Title>
          {result.days.map((day) => {
            const isExpanded = expandedDays.has(day.date)
            const dayHitRate = (day.hit_rate * 100).toFixed(2)
            return (
              <Card
                key={day.date}
                size="small"
                style={{ borderRadius: 8 }}
                bodyStyle={{ padding: 12 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleDay(day.date)}
                >
                  <Space size={16}>
                    <Text strong>{day.date}</Text>
                    <Tag>信号: {day.total_signals}</Tag>
                    <Tag color="success">命中: {day.hit_count}</Tag>
                    <Tag color="error">未命中: {day.miss_count}</Tag>
                    <Text type="warning" strong>命中率: {dayHitRate}%</Text>
                  </Space>
                  <Button
                    type="text"
                    icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                    size="small"
                  />
                </div>
                {isExpanded && (
                  <div style={{ marginTop: 12 }}>
                    <DayDetailTable details={day.details} />
                  </div>
                )}
              </Card>
            )
          })}
        </Space>
      </Space>
    </Card>
  )
}

export default BacktestResult
