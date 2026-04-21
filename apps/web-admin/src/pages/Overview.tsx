import React, { useEffect, useState } from 'react'
import { Row, Col, Card, Table, Tag, Timeline, Spin } from 'antd'
import {
  UserOutlined, RobotOutlined, DollarOutlined, EyeOutlined,
  RiseOutlined, FallOutlined,

  InfoCircleOutlined,
} from '@ant-design/icons'
import { adminApi } from '@/services/admin'
import { useUserLevelsStore } from '@/stores/userLevels'

const Overview: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({})
  const getLevelByValue = useUserLevelsStore((s) => s.getLevelByValue)

  useEffect(() => {
    useUserLevelsStore.getState().fetchLevels()
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      const data = await adminApi.getDashboardStats()
      setStats(data)
    } catch (error) {
      console.error('获取统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { title: '总用户数', value: stats.total_users || 0, variant: 'primary', change: stats.user_growth || 0, prefix: '' },
    { title: '今日新增用户', value: stats.new_users_today || 0, variant: 'success', change: 0, prefix: '+' },
    { title: 'VIP 用户数', value: stats.vip_users || 0, variant: 'warning', change: stats.vip_growth || 0, prefix: '' },
    { title: 'Agent 总数', value: stats.total_agents || 0, variant: 'purple', change: stats.agent_growth || 0, prefix: '' },
    { title: '本月返佣', value: stats.monthly_rebate || 0, variant: 'error', change: stats.rebate_growth || 0, prefix: '¥', isCurrency: true },
    { title: '待结算返佣', value: stats.pending_rebate || 0, variant: 'danger', change: 0, prefix: '¥', isCurrency: true },
  ]

  const variantClasses: Record<string, { bar: string; iconBg: string; iconText: string }> = {
    primary: { bar: 'from-[#7c3aed] to-[#a78bfa]', iconBg: 'bg-[#f5f3ff]', iconText: 'text-[#5b21b6]' },
    success: { bar: 'from-[#10b981] to-[#34d399]', iconBg: 'bg-[#ecfdf5]', iconText: 'text-[#059669]' },
    warning: { bar: 'from-[#f59e0b] to-[#fbbf24]', iconBg: 'bg-[#fffbeb]', iconText: 'text-[#b45309]' },
    purple:  { bar: 'from-[#8b5cf6] to-[#a78bfa]', iconBg: 'bg-[#f3e8ff]', iconText: 'text-[#7c3aed]' },
    error:   { bar: 'from-[#ef4444] to-[#f87171]', iconBg: 'bg-[#fef2f2]', iconText: 'text-[#b91c1c]' },
    danger:  { bar: 'from-[#ef4444] to-[#f87171]', iconBg: 'bg-[#fef2f2]', iconText: 'text-[#b91c1c]' },
    info:    { bar: 'from-[#3b82f6] to-[#60a5fa]', iconBg: 'bg-[#eff6ff]', iconText: 'text-[#1d4ed8]' },
  }

  const recentUsersColumns = [
    { title: '用户', dataIndex: 'email', key: 'email' },
    {
      title: 'VIP 等级', dataIndex: 'vip_level', key: 'vip_level',
      render: (level: number) => {
        const l = getLevelByValue(level)
        return l ? <Tag color={l.color || 'default'}>{l.name}</Tag> : <Tag>等级 {level}</Tag>
      },
    },
    { title: '注册时间', dataIndex: 'created_at', key: 'created_at' },
  ]

  const recentRebatesColumns = [
    { title: 'Agent Owner', dataIndex: 'owner_email', key: 'owner_email' },
    { title: '返佣金额', dataIndex: 'rebate_amount', key: 'rebate_amount', render: (a: number) => `¥${a.toFixed(2)}` },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = { pending: 'orange', settled: 'green', refunded: 'red' }
        const labels: Record<string, string> = { pending: '待结算', settled: '已结算', refunded: '已退款' }
        return <Tag color={colors[status]}>{labels[status] || status}</Tag>
      },
    },
    { title: '时间', dataIndex: 'created_at', key: 'created_at' },
  ]

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Spin size="large" />
        <div className="mt-4 text-[var(--color-text-secondary)]">加载中...</div>
      </div>
    )
  }

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0">概览</h1>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            实时监控平台核心数据指标</p>
      </div>

      <Row gutter={[12, 12]}>
        {statCards.map((card, i) => {
          const v = variantClasses[card.variant]
          const icons: Record<string, React.ReactNode> = {
            primary: <UserOutlined />, success: <RiseOutlined />, warning: <EyeOutlined />,
            purple: <RobotOutlined />, error: <DollarOutlined />, danger: <FallOutlined />,
          }
          return (
            <Col xs={24} sm={12} lg={8} xl={6} key={i} className="flex">
              <div className={`relative overflow-hidden bg-white border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] h-full flex flex-col`}>
                <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${v.bar}`} />
                <div className={`w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center text-lg mb-3 ${v.iconBg} ${v.iconText}`}>
                  {icons[card.variant]}
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)] leading-tight tracking-tight">
                  {card.prefix}{card.isCurrency ? card.value.toFixed(2) : card.value}
                </div>
                <div className="text-[13px] text-[var(--color-text-secondary)] mt-1 font-medium">{card.title}</div>
                <div className={`text-xs font-semibold mt-auto pt-2 ${card.change > 0 ? 'text-[var(--color-error)]' : card.change < 0 ? 'text-[var(--color-success)]' : 'opacity-0'}`}>
                  {card.change !== 0 ? `较上月 ${card.change > 0 ? '+' : ''}${card.change}%` : '较上月 0%'}
                </div>
              </div>
            </Col>
          )
        })}
      </Row>

      <Row gutter={[12, 12]} className="mt-4">
        <Col xs={24} lg={12}>
          <Card title="最近注册用户" className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
            <Table
              dataSource={stats.recent_users || []}
              columns={recentUsersColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="最近返佣记录" className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
            <Table
              dataSource={stats.recent_rebates || []}
              columns={recentRebatesColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} className="mt-4">
        <Col xs={24} lg={12}>
          <Card title="系统动态" className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
            <Timeline
              items={[
                { children: '系统正常运行中' },
                { children: '今日新增 12 个 Agent' },
                { children: '今日新增 5 个 VIP 用户' },
                { children: '返佣结算完成: ¥1,234.56' },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="热门 Agent" className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
            <Table
              dataSource={stats.hot_agents || []}
              columns={[
                { title: '名称', dataIndex: 'name', key: 'name' },
                { title: '使用量', dataIndex: 'usage_count', key: 'usage_count' },
                { title: '评分', dataIndex: 'rating', key: 'rating' },
              ]}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Overview
