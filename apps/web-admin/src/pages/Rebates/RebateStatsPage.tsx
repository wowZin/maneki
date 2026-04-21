import React, { useEffect, useState } from 'react'
import { Card, Row, Col, DatePicker, Table, Select, Space } from 'antd'
import { DollarOutlined, ShoppingCartOutlined, EyeOutlined, StopOutlined , InfoCircleOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { adminApi } from '../../services/admin'

const { RangePicker } = DatePicker
const { Option } = Select

const RebateStatsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(30, 'day'), dayjs()])
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

  const statCards = [
    { label: '总返佣金额', value: dashboard.total_rebate_amount || 0, icon: <DollarOutlined />, precision: 2, bar: 'from-[#7c3aed] to-[#a78bfa]', iconBg: 'bg-[#f5f3ff]', iconText: 'text-[#5b21b6]' },
    { label: '总订阅数', value: dashboard.total_subscriptions || 0, icon: <ShoppingCartOutlined />, bar: 'from-[#3b82f6] to-[#60a5fa]', iconBg: 'bg-[#eff6ff]', iconText: 'text-[#1d4ed8]' },
    { label: '待审核', value: dashboard.pending_count || 0, icon: <EyeOutlined />, bar: 'from-[#f59e0b] to-[#fbbf24]', iconBg: 'bg-[#fffbeb]', iconText: 'text-[#b45309]' },
    { label: '已拦截', value: dashboard.blocked_count || 0, icon: <StopOutlined />, bar: 'from-[#ef4444] to-[#f87171]', iconBg: 'bg-[#fef2f2]', iconText: 'text-[#b91c1c]' },
    { label: '审核中', value: dashboard.reviewing_count || 0, icon: <EyeOutlined />, bar: 'from-[#8b5cf6] to-[#a78bfa]', iconBg: 'bg-[#f3e8ff]', iconText: 'text-[#7c3aed]' },
    { label: '平均返佣', value: dashboard.avg_rebate_per_subscription || 0, icon: <DollarOutlined />, precision: 2, bar: 'from-[#10b981] to-[#34d399]', iconBg: 'bg-[#ecfdf5]', iconText: 'text-[#059669]' },
  ]

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0">返佣统计</h1>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            返佣数据趋势分析与创作者排名</p>
      </div>

      <Space className="mb-4">
        <RangePicker value={dateRange as any} onChange={(v: any) => v && setDateRange([v[0], v[1]])} />
        <Select value={groupBy} onChange={setGroupBy} style={{ width: 120 }}>
          <Option value="day">按日</Option>
          <Option value="week">按周</Option>
          <Option value="month">按月</Option>
        </Select>
      </Space>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {statCards.map((s, i) => (
          <div key={i} className="relative overflow-hidden bg-white border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
            <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${s.bar}`} />
            <div className={`w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center text-base mb-2 ${s.iconBg} ${s.iconText}`}>{s.icon}</div>
            <div className="text-xl font-bold text-[var(--color-text-primary)] leading-tight">{s.precision ? s.value.toFixed(s.precision) : s.value}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      <Card title="趋势分析" loading={loading} className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)] mb-4">
        <ReactECharts option={trendOption} style={{ height: 320 }} />
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card title="创作者排名" loading={loading} className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
            <Table columns={creatorColumns} dataSource={creators} rowKey="creator_id" pagination={{ total: creatorTotal, pageSize: 10, showSizeChanger: false }} size="small" />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Agent 统计" loading={loading} className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
            <Table columns={agentColumns} dataSource={agents} rowKey="agent_id" pagination={{ total: agentTotal, pageSize: 10, showSizeChanger: false }} size="small" />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default RebateStatsPage
