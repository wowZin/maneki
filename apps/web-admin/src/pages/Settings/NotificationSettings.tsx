/**
 * 通知配置页面
 */
import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Tag,
  Popconfirm,
  message,
  Modal,
  Form,
  Radio,
  DatePicker,
  InputNumber,
  Select,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  CopyOutlined,
  StopOutlined,
  EditOutlined,
  BellOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  systemNotificationApi,
  SystemNotification,
  CreateNotificationParams,
} from '../../services/systemNotification'

const { TextArea } = Input
const { RangePicker } = DatePicker

const NotificationSettings: React.FC = () => {
  const [data, setData] = useState<SystemNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false)
  const [modalTitle, setModalTitle] = useState('新建通知')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const fetchData = async (p = page, ps = pageSize) => {
    setLoading(true)
    try {
      const res = await systemNotificationApi.getList({
        page: p,
        page_size: ps,
        status: statusFilter || undefined,
        keyword: keyword || undefined,
      })
      if (res.code === 0) {
        setData(res.data)
        setTotal(res.total)
        setPage(res.page)
        setPageSize(res.page_size)
      } else {
        message.error(res.message || '获取列表失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const handleSearch = () => {
    setPage(1)
    fetchData(1, pageSize)
  }

  const handleReset = () => {
    setKeyword('')
    setStatusFilter('')
    setPage(1)
    fetchData(1, pageSize)
  }

  // 打开新建弹窗
  const openCreateModal = () => {
    setEditingId(null)
    setModalTitle('新建通知')
    form.resetFields()
    form.setFieldsValue({
      priority: 1,
      min_visible_level: 1,
    })
    setModalVisible(true)
  }

  // 打开编辑弹窗
  const openEditModal = (record: SystemNotification) => {
    if (record.status === 'disabled') {
      message.warning('已失效的通知不支持编辑')
      return
    }
    setEditingId(record.id)
    setModalTitle('编辑通知')
    form.setFieldsValue({
      title: record.title,
      content: record.content,
      priority: record.priority,
      min_visible_level: record.min_visible_level,
      timeRange: [
        dayjs(record.start_time),
        record.end_time ? dayjs(record.end_time) : null,
      ],
    })
    setModalVisible(true)
  }

  // 提交表单
  const handleSubmit = async (values: any) => {
    const [start, end] = values.timeRange || []
    if (!start) {
      message.error('请选择生效开始时间')
      return
    }

    const params: CreateNotificationParams = {
      title: values.title,
      content: values.content,
      priority: values.priority,
      start_time: start.format('YYYY-MM-DDTHH:mm:ss+08:00'),
      end_time: end ? end.format('YYYY-MM-DDTHH:mm:ss+08:00') : null,
      min_visible_level: values.min_visible_level,
    }

    setSubmitting(true)
    try {
      let res
      if (editingId) {
        const updateParams: any = {}
        if (values.title !== undefined) updateParams.title = values.title
        if (values.content !== undefined) updateParams.content = values.content
        if (values.priority !== undefined) updateParams.priority = values.priority
        if (values.min_visible_level !== undefined) updateParams.min_visible_level = values.min_visible_level
        updateParams.start_time = params.start_time
        updateParams.end_time = params.end_time
        res = await systemNotificationApi.update(editingId, updateParams)
      } else {
        res = await systemNotificationApi.create(params)
      }

      if (res.code === 0) {
        message.success(editingId ? '更新成功' : '创建成功')
        setModalVisible(false)
        form.resetFields()
        fetchData()
      } else {
        message.error(res.message || '操作失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 失效通知
  const handleDisable = async (id: number) => {
    try {
      const res = await systemNotificationApi.disable(id)
      if (res.code === 0) {
        message.success('通知已失效')
        fetchData()
      } else {
        message.error(res.message || '操作失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败')
    }
  }

  // 复制通知
  const handleDuplicate = async (id: number) => {
    try {
      const res = await systemNotificationApi.duplicate(id)
      if (res.code === 0) {
        message.success('复制成功')
        fetchData()
      } else {
        message.error(res.message || '复制失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '复制失败')
    }
  }

  // 状态标签颜色
  const statusColorMap: Record<string, string> = {
    pending: 'blue',
    active: 'green',
    expired: 'orange',
    disabled: 'default',
  }

  const statusLabelMap: Record<string, string> = {
    pending: '待生效',
    active: '生效中',
    expired: '已过期',
    disabled: '已失效',
  }

  // 优先级标签
  const priorityColorMap: Record<number, string> = {
    1: 'blue',
    2: 'red',
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
      fixed: 'left' as const,
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 280,
      ellipsis: {
        showTitle: false,
      },
      render: (title: string) => (
        <Tooltip placement="topLeft" title={title}>
          <span>{title}</span>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColorMap[status] || 'default'}>
          {statusLabelMap[status] || status}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 90,
      render: (priority: number) => (
        <Tag color={priorityColorMap[priority] || 'blue'}>
          {priority === 2 ? '紧急' : '普通'}
        </Tag>
      ),
    },
    {
      title: '生效时间',
      width: 380,
      render: (_: any, record: SystemNotification) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {dayjs(record.start_time).format('YYYY-MM-DD HH:mm:ss')}
          {record.end_time
            ? ` ~ ${dayjs(record.end_time).format('YYYY-MM-DD HH:mm:ss')}`
            : ' ~ 永久'}
        </span>
      ),
    },
    {
      title: '可见群体',
      dataIndex: 'min_visible_level',
      width: 110,
      render: (level: number) => <span style={{ whiteSpace: 'nowrap' }}>≥ {level} 级</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 185,
      render: (v: string) => <span style={{ whiteSpace: 'nowrap' }}>{dayjs(v).format('YYYY-MM-DD HH:mm:ss')}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: SystemNotification) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
              disabled={record.status === 'disabled'}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleDuplicate(record.id)}
            />
          </Tooltip>
          {record.status !== 'disabled' && record.status !== 'expired' && (
            <Popconfirm
              title="确定将该通知设为失效？"
              description="失效后该通知将不再对用户可见"
              onConfirm={() => handleDisable(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="失效">
                <Button type="text" danger size="small" icon={<StopOutlined />}>
                  失效
                </Button>
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>
          <BellOutlined /> 通知配置
        </h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          新建通知
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索标题"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="状态筛选"
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
            style={{ width: 140 }}
            allowClear
            options={[
              { label: '全部', value: '' },
              { label: '待生效', value: 'pending' },
              { label: '生效中', value: 'active' },
              { label: '已过期', value: 'expired' },
              { label: '已失效', value: 'disabled' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps || 10)
            fetchData(p, ps || 10)
          },
        }}
      />

      <Modal
        title={
          <Space>
            {editingId ? <EditOutlined /> : <PlusOutlined />}
            {modalTitle}
          </Space>
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={640}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            priority: 1,
            min_visible_level: 1,
          }}
        >
          <Form.Item
            name="title"
            label="通知标题"
            rules={[
              { required: true, message: '请输入通知标题' },
              { max: 200, message: '标题最多200字符' },
            ]}
          >
            <Input placeholder="请输入通知标题" maxLength={200} showCount />
          </Form.Item>

          <Form.Item
            name="priority"
            label="消息类型"
            rules={[{ required: true, message: '请选择消息类型' }]}
          >
            <Radio.Group>
              <Radio value={1}>
                <Tag color="blue">普通</Tag>
              </Radio>
              <Radio value={2}>
                <Tag color="red">
                  <ExclamationCircleOutlined /> 紧急
                </Tag>
              </Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="timeRange"
            label="生效时间"
            rules={[{ required: true, message: '请选择生效时间' }]}
          >
            <RangePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              placeholder={['开始时间（必填）', '结束时间（可选）']}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="min_visible_level"
            label="最低可见等级"
            rules={[
              { required: true, message: '请输入最低可见等级' },
              { type: 'number', min: 1, message: '等级必须≥1' },
            ]}
            help="等级数值 ≥ 该值的用户均可见此通知"
          >
            <InputNumber min={1} style={{ width: 200 }} placeholder="例如：1" />
          </Form.Item>

          <Form.Item
            name="content"
            label="消息内容"
            rules={[{ required: true, message: '请输入消息内容' }]}
          >
            <TextArea
              rows={6}
              placeholder="支持 HTML 富文本格式"
              maxLength={5000}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default NotificationSettings
