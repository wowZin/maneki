import React, { useState, useEffect } from 'react'
import { Card, Form, DatePicker, Button, Select, Typography, Space, Alert, message } from 'antd'
import { HistoryOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { backtestApi } from '../../services/backtest'
import { marketplaceApi } from '../../services/marketplace'
import { useAuthStore } from '../../stores/auth'
import type { MySubscriptionItem } from '../../services/marketplace'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface BacktestFormProps {
  preselectedAgentId?: number
  onBacktestCreated?: (jobId: number) => void
}

const BacktestForm: React.FC<BacktestFormProps> = ({ preselectedAgentId, onBacktestCreated }) => {
  const [form] = Form.useForm()
  const { user } = useAuthStore()
  const [subscriptions, setSubscriptions] = useState<MySubscriptionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isVIP = (user?.vip_level || 0) >= 1

  useEffect(() => {
    const fetchSubscriptions = async () => {
      setLoading(true)
      try {
        const res = await marketplaceApi.getMySubscriptions({ status: 'active' })
        setSubscriptions(res.items)
      } catch (err) {
        console.error('Failed to fetch subscriptions:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchSubscriptions()
  }, [])

  useEffect(() => {
    if (preselectedAgentId) {
      form.setFieldsValue({ agent_id: preselectedAgentId })
    }
  }, [preselectedAgentId, form])

  const handleSubmit = async (values: { agent_id: number; date_range: [Dayjs, Dayjs] }) => {
    setError(null)
    setSubmitting(true)
    try {
      const startDate = values.date_range[0].format('YYYY-MM-DD')
      const endDate = values.date_range[1].format('YYYY-MM-DD')

      const res = await backtestApi.createBacktest({
        agent_id: values.agent_id,
        start_date: startDate,
        end_date: endDate,
      })

      message.success('回测任务已创建')
      onBacktestCreated?.(res.id)
      form.resetFields(['date_range'])
    } catch (err: any) {
      const errData = err?.response?.data?.error
      if (errData?.code === 'VIP_REQUIRED') {
        setError('回测功能仅限 VIP 用户使用')
      } else if (errData?.code === 'SUBSCRIPTION_REQUIRED') {
        setError('您未订阅该 Agent，无法回测')
      } else if (errData?.code === 'INVALID_DATE_RANGE') {
        setError('回测日期范围不能超过14天')
      } else if (errData?.code === 'JOB_ALREADY_RUNNING') {
        setError('该 Agent 已有正在进行的回测任务')
      } else {
        setError(errData?.message || '创建回测任务失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const disabledDate = (current: Dayjs) => {
    return current && current > dayjs().endOf('day')
  }

  const validateDateRange = (_: any, value: [Dayjs, Dayjs]) => {
    if (!value || !value[0] || !value[1]) {
      return Promise.resolve()
    }
    const days = value[1].diff(value[0], 'day') + 1
    if (days > 14) {
      return Promise.reject(new Error('回测日期范围不能超过14天'))
    }
    return Promise.resolve()
  }

  if (!isVIP) {
    return (
      <Card className="glass-card">
        <Alert
          message="VIP 专享功能"
          description="回测分析功能仅限 VIP 及以上会员使用，请升级会员以解锁此功能。"
          type="warning"
          showIcon
        />
      </Card>
    )
  }

  return (
    <Card className="glass-card">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>
          <HistoryOutlined style={{ marginRight: 8 }} />
          创建回测
        </Title>
        <Text type="secondary">选择已订阅的 Agent 和日期范围，系统将自动计算该 Agent 在历史数据上的表现。</Text>

        {error && (
          <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 8 }}
        >
          <Form.Item
            name="agent_id"
            label="选择 Agent"
            rules={[{ required: true, message: '请选择要回测的 Agent' }]}
          >
            <Select
              placeholder="请选择已订阅的 Agent"
              loading={loading}
              options={subscriptions.map((sub) => ({
                value: sub.agent_id,
                label: sub.agent_name,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="date_range"
            label="回测日期范围"
            rules={[
              { required: true, message: '请选择回测日期范围' },
              { validator: validateDateRange },
            ]}
          >
            <RangePicker
              style={{ width: '100%' }}
              disabledDate={disabledDate}
              maxDate={dayjs()}
              placeholder={['开始日期', '结束日期']}
            />
          </Form.Item>

          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
            最多支持最近 14 天的涨停股票数据回测
          </Text>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              icon={<PlayCircleOutlined />}
              size="large"
              block
            >
              开始回测
            </Button>
          </Form.Item>
        </Form>
      </Space>
    </Card>
  )
}

export default BacktestForm
