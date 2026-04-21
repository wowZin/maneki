import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, DatePicker, Table, Select, Space, Typography } from 'antd'
import { DollarOutlined, ShoppingCartOutlined, EyeOutlined, StopOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { adminApi } from '../../services/admin'

const { RangePicker } = DatePicker
const { Option } = Select

const RebateStatsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [groupBy, setGroupBy] = useState('day')
  const [loading, setLoading] = useState(false)

  const [dashboard, setDashboard] = useState<any>({})
  const [trend, setTrend] = useState<any[]>([])
  const [creators, setCreators] = useState<any[]>([])
  const [creatorTotal, setCreatorTotal] = useState(0)
  const [agents, setAgents] = useState<any[]>([])
  const [agentTotal, setAgentTotal] = useState(0)

  const startDate = dateRange[0].format('YYYY-MM-DD')
  const endDate = dateRange[1].format('YYYY-MM-DD')

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [dash, tr, cr, ag] = await Promise.all([
        adminApi.getRebateDashboardStats({ start_date: startDate, end_date: endDate }),
        adminApi.getRebateTrend({ group_by: groupBy, start_date: startDate, end_date: endDate }),
        adminApi.getRebateCreatorRanking({ page: 1, pageSize: 10, start_date: startDate, end_date: endDate }),
        adminApi.getRebateAgentStats({ page: 1, pageSize: 10, start_date: startDate, end_date: endDate }),
      ])
      setDashboard(dash)
      setTrend(tr.data || [])
      setCreators(cr.data || [])
      setCreatorTotal(cr.total || 0)
      setAgents(ag.data || [])
      setAgentTotal(ag.total || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, groupBy])

  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['返佣金额', '订阅数', '拦截数'] },
    xAxis: { type: 'category', data: trend.map((i: any) => i.date) },
    yAxis: [{ type: 'value', name: '金额' }, { type: 'value', name: '数量' }],
    series: [
      { name: '返佣金额', type: 'bar', data: trend.map((i: any) => parseFloat(i.rebate_amount) || 0) },
      { name: '订阅数', type: 'line', yAxisIndex: 1, data: trend.map((i: any) => parseInt(i.subscription_count) || 0) },
      { name: '拦截数', type: 'line', yAxisIndex: 1, data: trend.map((i: any) => parseInt(i.blocked_count) || 0) },
    ],
  }

  const creatorColumns = [
    { title: '创作者ID', dataIndex: 'creator_id', key: 'creator_id' },
    { title: '总返佣金额', dataIndex: 'total_amount', key: 'total_amount', render: (v: number) => `¥${v?.toFixed(2) || '0.00'}` },
    { title: '订阅数', dataIndex: 'subscription_count', key: 'subscription_count' },
    { title: 'Agent数', dataIndex: 'agent_count', key: 'agent_count' },
  ]

  const agentColumns = [
    { title: 'AgentID', dataIndex: 'agent_id', key: 'agent_id' },
    { title: '总返佣金额', dataIndex: 'total_amount', key: 'total_amount', render: (v: number) => `¥${v?.toFixed(2) || '0.00'}` },
    { title: '订阅数', dataIndex: 'subscription_count', key: 'subscription_count' },
  ]

  return (
    <div>
      <Typography.Title level={4}>返佣统计</Typography.Title>

      <Space style={{ marginBottom: 16 }}>
        <RangePicker value={dateRange as any} onChange={(v: any) => v && setDateRange([v[0], v[1]])} />
        <Select value={groupBy} onChange={setGroupBy} style={{ width: 120 }}>
          <Option value="day">按日</Option>
          <Option value="week">按周</Option>
          <Option value="month">按月</Option>
        </Select>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="总返佣金额"
              value={dashboard.total_rebate_amount || 0}
              prefix={<DollarOutlined />}
              precision={2}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="总订阅数"
              value={dashboard.total_subscriptions || 0}
              prefix={<ShoppingCartOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="待审核"
              value={dashboard.pending_count || 0}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已拦截"
              value={dashboard.blocked_count || 0}
              prefix={<StopOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="审核中"
              value={dashboard.reviewing_count || 0}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="平均返佣"
              value={dashboard.avg_rebate_per_subscription || 0}
              prefix={<DollarOutlined />}
              precision={2}
            />
          </Card>
        </Col>
      </Row>

      <Card title="趋势分析" style={{ marginBottom: 16 }} loading={loading}>
        <ReactECharts option={trendOption} style={{ height: 320 }} />
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="创作者排名" loading={loading}>
            <Table
              columns={creatorColumns}
              dataSource={creators}
              rowKey="creator_id"
              pagination={{ total: creatorTotal, pageSize: 10, showSizeChanger: false }}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Agent 统计" loading={loading}>
            <Table
              columns={agentColumns}
              dataSource={agents}
              rowKey="agent_id"
              pagination={{ total: agentTotal, pageSize: 10, showSizeChanger: false }}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default RebateStatsPage
