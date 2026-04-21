/**
 * 返佣管理页面
 */

import React, { useState, useEffect } from 'react'
import {
  Table,
  Card,
  Button,
  Input,
  Space,
  Tag,
  Select,
  message,
  Row,
  Col,
  Statistic,
  Timeline,
} from 'antd'
import {
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  UserOutlined,
  RobotOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { adminApi } from '@/services/admin'
import dayjs from 'dayjs'


interface Rebate {
  id: number
  subscription_id: string
  owner_email: string
  subscriber_email: string
  template_name: string
  rebate_amount: number
  subscription_amount: number
  subscription_days: number
  status: 'pending' | 'settled' | 'refunded'
  settlement_at?: string
  settled_at?: string
  created_at: string
}

const Rebates: React.FC = () => {
  const [rebates, setRebates] = useState<Rebate[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [stats, setStats] = useState<any>({})

  useEffect(() => {
    fetchRebates()
    fetchStats()
  }, [pagination.current, pagination.pageSize, statusFilter])

  const fetchRebates = async () => {
    try {
      setLoading(true)
      const data = await adminApi.getRebates({
        page: pagination.current,
        pageSize: pagination.pageSize,
        search: searchText,
        status: statusFilter,
      })
      setRebates(data.items)
      setPagination({ ...pagination, total: data.total })
    } catch (error) {
      message.error('获取返佣列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const data = await adminApi.getRebateStats()
      setStats(data)
    } catch (error) {
      console.error('获取统计失败:', error)
    }
  }

  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 })
    fetchRebates()
  }

  const handleBatchSettle = async () => {
    try {
      await adminApi.batchSettleRebates()
      message.success('批量结算完成')
      fetchRebates()
      fetchStats()
    } catch (error) {
      message.error('结算失败')
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Agent Owner',
      dataIndex: 'owner_email',
      key: 'owner_email',
      render: (email: string) => (
        <Space>
          <UserOutlined />
          {email}
        </Space>
      ),
    },
    {
      title: '订阅用户',
      dataIndex: 'subscriber_email',
      key: 'subscriber_email',
    },
    {
      title: 'Agent 模板',
      dataIndex: 'template_name',
      key: 'template_name',
      render: (name: string) => (
        <Space>
          <RobotOutlined />
          {name}
        </Space>
      ),
    },
    {
      title: '返佣金额',
      dataIndex: 'rebate_amount',
      key: 'rebate_amount',
      render: (amount: number) => (
        <span style={{ color: '#10b981', fontWeight: 'bold' }}>¥{amount.toFixed(2)}</span>
      ),
    },
    {
      title: '订阅金额',
      dataIndex: 'subscription_amount',
      key: 'subscription_amount',
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    {
      title: '订阅天数',
      dataIndex: 'subscription_days',
      key: 'subscription_days',
      render: (days: number) => `${days} 天`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: Rebate) => {
        const configs: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
          pending: {
            color: 'orange',
            icon: <ClockCircleOutlined />,
            text: '待结算',
          },
          settled: {
            color: 'green',
            icon: <CheckCircleOutlined />,
            text: '已结算',
          },
          refunded: {
            color: 'red',
            icon: <CloseCircleOutlined />,
            text: '已退款',
          },
        }
        const config = configs[status]
        return (
          <Space direction="vertical" size={0}>
            <Tag color={config.color} icon={config.icon}>
              {config.text}
            </Tag>
            {status === 'pending' && record.settlement_at && (
              <span style={{ fontSize: 12, color: '#999' }}>
                预计 {dayjs(record.settlement_at).format('MM-DD')}
              </span>
            )}
          </Space>
        )
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>返佣管理</h2>

      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="累计返佣"
              value={stats.total_rebate || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#3b82f6' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待结算返佣"
              value={stats.pending_rebate || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月返佣"
              value={stats.this_month_rebate || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="返佣记录数"
              value={pagination.total}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col span={16}>
          <Card title="近期结算动态">
            <Timeline
              items={[
                {
                  dot: <CheckCircleOutlined style={{ color: '#10b981' }} />,
                  children: '今日结算完成: ¥1,234.56',
                },
                {
                  dot: <DollarOutlined style={{ color: '#3b82f6' }} />,
                  children: '新增返佣 5 笔',
                },
                {
                  children: '本周累计结算: ¥5,678.90',
                },
              ]}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="快捷操作">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleBatchSettle}
                block
              >
                批量结算到期返佣
              </Button>
              <Button icon={<ReloadOutlined />} onClick={fetchRebates} block>
                刷新数据
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title="返佣记录"
        extra={
          <Space>
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: 120 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: '待结算', value: 'pending' },
                { label: '已结算', value: 'settled' },
                { label: '已退款', value: 'refunded' },
              ]}
            />
            <Input
              placeholder="搜索用户/Agent"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
            />
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={rebates}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={(p) =>
            setPagination({ ...pagination, current: p.current || 1, pageSize: p.pageSize || 20 })
          }
        />
      </Card>
    </div>
  )
}

export default Rebates
