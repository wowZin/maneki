import React, { useEffect, useState } from 'react'
import {
  Table,
  Card,
  Tag,
  Space,
  Select,
  DatePicker,
  Button,
  Modal,
  Form,
  Input,
  message,
  InputNumber,
  Typography,
} from 'antd'
import { EyeOutlined, CheckOutlined, StopOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { adminApi } from '../../services/admin'

const { RangePicker } = DatePicker
const { Option } = Select
const { TextArea } = Input

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待结算', color: 'gold' },
  settled: { label: '已结算', color: 'green' },
  blocked: { label: '已拦截', color: 'red' },
  reviewing: { label: '审核中', color: 'blue' },
  refunded: { label: '已退款', color: 'default' },
}

const RebateRecordsPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [status, setStatus] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [agentId, setAgentId] = useState<number | undefined>()
  const [creatorId, setCreatorId] = useState<number | undefined>()

  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewRecord, setReviewRecord] = useState<any>(null)
  const [reviewForm] = Form.useForm()

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const params: any = { page, pageSize }
      if (status) params.status = status
      if (agentId) params.agent_id = agentId
      if (creatorId) params.creator_id = creatorId
      if (dateRange) {
        params.start_date = dateRange[0].format('YYYY-MM-DD')
        params.end_date = dateRange[1].format('YYYY-MM-DD')
      }
      const res = await adminApi.getRebateRecords(params)
      setRecords(res.data || [])
      setTotal(res.total || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status, dateRange, agentId, creatorId])

  const handleReview = async (values: any) => {
    if (!reviewRecord) return
    try {
      await adminApi.reviewRebateRecord(reviewRecord.id, values)
      message.success('审核完成')
      setReviewModalOpen(false)
      fetchRecords()
    } catch (e: any) {
      message.error(e.response?.data?.error || '审核失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '订阅ID', dataIndex: 'subscription_id', key: 'subscription_id', width: 90 },
    { title: 'AgentID', dataIndex: 'agent_id', key: 'agent_id', width: 90 },
    { title: '创作者ID', dataIndex: 'creator_id', key: 'creator_id', width: 100 },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 100,
      render: (v: number) => `¥${v?.toFixed(2) || '0.00'}`,
    },
    {
      title: '返佣金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (v: number) => (
        <span style={{ fontWeight: 'bold', color: v > 0 ? '#52c41a' : '#999' }}>
          ¥{v?.toFixed(2) || '0.00'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const cfg = statusMap[s] || { label: s, color: 'default' }
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: '套利标签',
      dataIndex: 'arbitrage_tags',
      key: 'arbitrage_tags',
      render: (tags: string[] | null) =>
        tags?.length ? (
          <Space size={4}>
            {tags.map((t) => (
              <Tag key={t} color="red">
                {t}
              </Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => {
        if (record.status !== 'reviewing') return null
        return (
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setReviewRecord(record)
              reviewForm.resetFields()
              setReviewModalOpen(true)
            }}
          >
            审核
          </Button>
        )
      },
    },
  ]

  return (
    <div>
      <Typography.Title level={4}>返佣记录</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 120 }}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <Option value="pending">待结算</Option>
            <Option value="settled">已结算</Option>
            <Option value="blocked">已拦截</Option>
            <Option value="reviewing">审核中</Option>
            <Option value="refunded">已退款</Option>
          </Select>
          <InputNumber
            placeholder="AgentID"
            style={{ width: 120 }}
            value={agentId}
            onChange={(v) => {
              setAgentId(v || undefined)
              setPage(1)
            }}
          />
          <InputNumber
            placeholder="创作者ID"
            style={{ width: 120 }}
            value={creatorId}
            onChange={(v) => {
              setCreatorId(v || undefined)
              setPage(1)
            }}
          />
          <RangePicker
            value={dateRange as any}
            onChange={(v: any) => {
              setDateRange(v)
              setPage(1)
            }}
          />
          <Button type="primary" onClick={fetchRecords}>
            查询
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps || 20)
          },
        }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="审核返佣记录"
        open={reviewModalOpen}
        onCancel={() => setReviewModalOpen(false)}
        onOk={() => reviewForm.submit()}
      >
        {reviewRecord && (
          <div style={{ marginBottom: 16 }}>
            <p>
              记录ID: <strong>{reviewRecord.id}</strong>
            </p>
            <p>
              订阅ID: <strong>{reviewRecord.subscription_id}</strong>
            </p>
            <p>
              返佣金额: <strong>¥{reviewRecord.amount?.toFixed(2)}</strong>
            </p>
            <p>
              套利标签:{' '}
              {reviewRecord.arbitrage_tags?.length ? (
                reviewRecord.arbitrage_tags.map((t: string) => (
                  <Tag key={t} color="red">
                    {t}
                  </Tag>
                ))
              ) : (
                '无'
              )}
            </p>
          </div>
        )}
        <Form form={reviewForm} onFinish={handleReview} layout="vertical">
          <Form.Item
            name="conclusion"
            label="审核结论"
            rules={[{ required: true, message: '请选择审核结论' }]}
          >
            <Select placeholder="请选择">
              <Option value="normal">
                <Space>
                  <CheckOutlined style={{ color: '#52c41a' }} />
                  正常通过
                </Space>
              </Option>
              <Option value="arbitrage">
                <Space>
                  <StopOutlined style={{ color: '#ff4d4f' }} />
                  确认套利
                </Space>
              </Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="可填写审核备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default RebateRecordsPage
