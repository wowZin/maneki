import React, { useState, useEffect } from 'react'
import { Card, Table, Tag, Space, Spin, Empty, Typography, Radio } from 'antd'
import { BarChartOutlined, RiseOutlined, FallOutlined, MinusOutlined, ReloadOutlined } from '@ant-design/icons'
import { overviewApi, type AgentPerformanceItem } from '../../../services/overview'

const { Text } = Typography

const PERIOD_OPTIONS = [
  { label: '近7日', value: '7d' },
  { label: '近30日', value: '30d' },
  { label: '全部', value: 'all' },
]

const AgentPerformanceTable: React.FC = () => {
  const [data, setData] = useState<AgentPerformanceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('7d')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await overviewApi.getAgentPerformance(period)
      setData(res.agents)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [period])

  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 60,
      render: (rank: number) => (
        <span style={{
          fontWeight: 700,
          color: rank === 1 ? '#f59e0b' : rank === 2 ? '#9ca3af' : rank === 3 ? '#b45309' : '#6b7280',
        }}>
          {rank}
        </span>
      ),
    },
    {
      title: 'Agent',
      dataIndex: 'agent_name',
      key: 'agent_name',
      render: (name: string, record: AgentPerformanceItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.agent_type}</Text>
        </div>
      ),
    },
    {
      title: '预测次数',
      dataIndex: 'total_predictions',
      key: 'total_predictions',
      align: 'right' as const,
    },
    {
      title: '命中次数',
      dataIndex: 'hit_count',
      key: 'hit_count',
      align: 'right' as const,
    },
    {
      title: '命中率',
      dataIndex: 'hit_rate',
      key: 'hit_rate',
      align: 'right' as const,
      render: (rate: number) => (
        <span style={{ fontWeight: 600, color: rate >= 0.7 ? '#10b981' : rate >= 0.4 ? '#f59e0b' : '#ef4444' }}>
          {(rate * 100).toFixed(1)}%
        </span>
      ),
    },
    {
      title: '趋势',
      dataIndex: 'trend',
      key: 'trend',
      align: 'center' as const,
      render: (trend: string) => {
        if (trend === 'up') return <Tag color="success" icon={<RiseOutlined />}>上升</Tag>
        if (trend === 'down') return <Tag color="error" icon={<FallOutlined />}>下降</Tag>
        return <Tag color="default" icon={<MinusOutlined />}>平稳</Tag>
      },
    },
  ]

  return (
    <Card
      title={
        <Space>
          <BarChartOutlined style={{ color: '#c9a227' }} />
          <span>Agent 命中率</span>
        </Space>
      }
      extra={
        <Space>
          <Radio.Group
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            size="small"
            optionType="button"
            buttonStyle="solid"
          />
          <ReloadOutlined onClick={fetchData} style={{ cursor: 'pointer', color: '#6b7280' }} />
        </Space>
      }
      className="glass-card"
      style={{ borderRadius: 16, height: '100%' }}
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Spin tip="加载中..." />
        </div>
      ) : error ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Empty description={error} />
        </div>
      ) : !data || data.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Empty description="暂无 Agent 数据" />
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={data}
          rowKey="agent_id"
          pagination={false}
          size="small"
          scroll={{ y: 320 }}
        />
      )}
    </Card>
  )
}

export default AgentPerformanceTable
