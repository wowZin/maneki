/**
 * 管理后台概览页面
 */

import React, { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Timeline, Spin } from 'antd'
import {
  UserOutlined,
  RobotOutlined,
  DollarOutlined,
  EyeOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons'
import { adminApi } from '@/services/admin'

const Overview: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({})

  useEffect(() => {
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
    {
      title: '总用户数',
      value: stats.total_users || 0,
      icon: <UserOutlined style={{ color: '#3b82f6' }} />,
      change: stats.user_growth || 0,
      prefix: '',
    },
    {
      title: '今日新增用户',
      value: stats.new_users_today || 0,
      icon: <RiseOutlined style={{ color: '#10b981' }} />,
      change: 0,
      prefix: '+',
    },
    {
      title: 'VIP 用户数',
      value: stats.vip_users || 0,
      icon: <EyeOutlined style={{ color: '#f59e0b' }} />,
      change: stats.vip_growth || 0,
      prefix: '',
    },
    {
      title: 'Agent 总数',
      value: stats.total_agents || 0,
      icon: <RobotOutlined style={{ color: '#8b5cf6' }} />,
      change: stats.agent_growth || 0,
      prefix: '',
    },
    {
      title: '本月返佣',
      value: stats.monthly_rebate || 0,
      icon: <DollarOutlined style={{ color: '#ec4899' }} />,
      change: stats.rebate_growth || 0,
      prefix: '¥',
      isCurrency: true,
    },
    {
      title: '待结算返佣',
      value: stats.pending_rebate || 0,
      icon: <FallOutlined style={{ color: '#ef4444' }} />,
      change: 0,
      prefix: '¥',
      isCurrency: true,
    },
  ]

  const recentUsersColumns = [
    {
      title: '用户',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'VIP 等级',
      dataIndex: 'vip_level',
      key: 'vip_level',
      render: (level: number) => {
        const colors = ['default', 'gold', 'purple']
        const labels = ['免费', 'VIP', 'SVIP']
        return <Tag color={colors[level] || 'default'}>{labels[level] || '免费'}</Tag>
      },
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
  ]

  const recentRebatesColumns = [
    {
      title: 'Agent Owner',
      dataIndex: 'owner_email',
      key: 'owner_email',
    },
    {
      title: '返佣金额',
      dataIndex: 'rebate_amount',
      key: 'rebate_amount',
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          pending: 'orange',
          settled: 'green',
          refunded: 'red',
        }
        const labels: Record<string, string> = {
          pending: '待结算',
          settled: '已结算',
          refunded: '已退款',
        }
        return <Tag color={colors[status]}>{labels[status] || status}</Tag>
      },
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>概览</h2>

      <Row gutter={[16, 16]}>
        {statCards.map((card, index) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={index}>
            <Card>
              <Statistic
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {card.icon}
                    <span>{card.title}</span>
                  </div>
                }
                value={card.value}
                prefix={card.prefix}
                precision={card.isCurrency ? 2 : 0}
                valueStyle={{
                  color: card.change > 0 ? '#10b981' : card.change < 0 ? '#ef4444' : 'inherit',
                }}
              />
              {card.change !== 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  较上月 {card.change > 0 ? '+' : ''}{card.change}%
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="最近注册用户">
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
          <Card title="最近返佣记录">
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

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="系统动态">
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
          <Card title="热门 Agent">
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
