/**
 * Agent 管理 - 列表页
 */

import React, { useState, useEffect } from 'react'
import {
  Table,
  Card,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  Switch,
  message,
  Popconfirm,
  Avatar,
  Row,
  Col,
  Statistic,
  Rate,
  Tooltip,
} from 'antd'
import {
  SearchOutlined,
  EditOutlined,
  StarOutlined,
  CheckCircleOutlined,
  StopOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '@/services/admin'
import dayjs from 'dayjs'

interface AgentItem {
  id: number
  name: string
  description?: string
  avatar?: string
  type: string
  category?: string
  prompt?: string
  model?: string
  is_active: boolean
  is_featured: boolean
  is_official: boolean
  use_count: number
  rating: number
  owner_id?: string
  created_at: string
  updated_at: string
}

const Agents: React.FC = () => {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<AgentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [searchText, setSearchText] = useState('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentItem | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchAgents()
  }, [pagination.current, pagination.pageSize])

  const fetchAgents = async () => {
    try {
      setLoading(true)
      const data = await adminApi.getAgentTemplates({
        page: pagination.current,
        pageSize: pagination.pageSize,
        search: searchText,
      })
      setAgents(data.items || [])
      setPagination({ ...pagination, total: data.total })
    } catch (error) {
      message.error('获取 Agent 列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 })
    fetchAgents()
  }

  const handleEdit = (agent: AgentItem) => {
    setEditingAgent(agent)
    form.setFieldsValue({
      name: agent.name,
      description: agent.description,
      type: agent.type,
      category: agent.category,
      prompt: agent.prompt,
      model: agent.model,
      is_active: agent.is_active,
      is_featured: agent.is_featured,
    })
    setIsEditModalOpen(true)
  }

  const handleSave = async (values: any) => {
    try {
      if (!editingAgent) return
      await adminApi.updateAgentTemplate(String(editingAgent.id), values)
      message.success('Agent 更新成功')
      setIsEditModalOpen(false)
      fetchAgents()
    } catch (error) {
      message.error('更新失败')
    }
  }

  const handleToggleFeatured = async (agent: AgentItem) => {
    try {
      await adminApi.updateAgentTemplate(String(agent.id), {
        is_featured: !agent.is_featured,
      })
      message.success(agent.is_featured ? '已取消精选' : '已设为精选')
      fetchAgents()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleDelete = async (agent: AgentItem) => {
    try {
      await adminApi.deleteAgent(String(agent.id))
      message.success('删除成功')
      fetchAgents()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const columns = [
    {
      title: 'Agent',
      key: 'agent',
      render: (agent: AgentItem) => (
        <Space>
          <Avatar style={{ backgroundColor: '#8b5cf6' }}>
            {agent.name[0]?.toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{agent.name}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {agent.description?.slice(0, 30) || '无描述'}
              {agent.description && agent.description.length > 30 ? '...' : ''}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const labels: Record<string, string> = {
          technical: '技术面',
          fundamental: '基本面',
          sentiment: '情绪面',
          capital: '资金面',
          decision: '决策',
          custom: '自定义',
        }
        return <Tag>{labels[type] || type}</Tag>
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => {
        const colors: Record<string, string> = {
          trend: 'blue',
          volume: 'green',
          breakout: 'orange',
          sentiment: 'purple',
          custom: 'default',
        }
        return <Tag color={colors[category] || 'default'}>{category || '-'}</Tag>
      },
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      render: (model: string) => model || '-',
    },
    {
      title: '评分',
      key: 'rating',
      render: (agent: AgentItem) => (
        <Space>
          <Rate disabled defaultValue={agent.rating} allowHalf style={{ fontSize: 14 }} />
        </Space>
      ),
    },
    {
      title: '使用量',
      dataIndex: 'use_count',
      key: 'use_count',
    },
    {
      title: '状态',
      key: 'status',
      render: (agent: AgentItem) => (
        <Space>
          {agent.is_active && <Tag color="success">启用</Tag>}
          {!agent.is_active && <Tag color="default">停用</Tag>}
          {agent.is_featured && (
            <Tag color="gold" icon={<StarOutlined />}>
              精选
            </Tag>
          )}
          {agent.is_official && <Tag color="blue">官方</Tag>}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (agent: AgentItem) => (
        <Space>
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(agent)} />
          </Tooltip>
          <Popconfirm
            title={agent.is_featured ? '取消精选' : '设为精选'}
            description={
              agent.is_featured
                ? '确定要取消该 Agent 的精选状态吗？'
                : '设为精选后，该 Agent 将对免费用户可见。'
            }
            onConfirm={() => handleToggleFeatured(agent)}
          >
            <Button
              type="text"
              icon={agent.is_featured ? <StopOutlined /> : <CheckCircleOutlined />}
            >
              {agent.is_featured ? '取消精选' : '精选'}
            </Button>
          </Popconfirm>
          <Popconfirm
            title="删除 Agent"
            description="确定要删除该 Agent 吗？此操作不可恢复。"
            onConfirm={() => handleDelete(agent)}
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const stats = {
    total: pagination.total,
    public: agents.filter((a) => a.is_active).length,
    featured: agents.filter((a) => a.is_featured).length,
    totalUsage: agents.reduce((sum, a) => sum + (a.use_count || 0), 0),
  }

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <h2 style={{ margin: 0 }}>Agent 管理</h2>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/agents/create')}>
            新增 Agent
          </Button>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Agent 总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="启用 Agent" value={stats.public} valueStyle={{ color: '#10b981' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="精选 Agent" value={stats.featured} valueStyle={{ color: '#f59e0b' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总使用次数" value={stats.totalUsage} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Agent 列表"
        extra={
          <Space>
            <Input
              placeholder="搜索名称/描述"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              style={{ width: 250 }}
              allowClear
            />
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={agents}
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

      <Modal
        title="编辑 Agent"
        open={isEditModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsEditModalOpen(false)}
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入 Agent 名称' }]}
          >
            <Input maxLength={30} showCount />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} maxLength={300} showCount />
          </Form.Item>

          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '技术面', value: 'technical' },
                { label: '基本面', value: 'fundamental' },
                { label: '情绪面', value: 'sentiment' },
                { label: '资金面', value: 'capital' },
                { label: '决策', value: 'decision' },
                { label: '自定义', value: 'custom' },
              ]}
            />
          </Form.Item>

          <Form.Item name="category" label="分类">
            <Select
              allowClear
              options={[
                { label: '趋势', value: 'trend' },
                { label: '量能', value: 'volume' },
                { label: '突破', value: 'breakout' },
                { label: '情绪', value: 'sentiment' },
                { label: '自定义', value: 'custom' },
              ]}
            />
          </Form.Item>

          <Form.Item name="prompt" label="提示词">
            <Input.TextArea rows={4} placeholder="支持 Markdown 格式" />
          </Form.Item>

          <Form.Item name="model" label="模型">
            <Select
              allowClear
              placeholder="请选择模型"
              options={[
                { label: 'Qwen-Turbo', value: 'qwen-turbo' },
                { label: 'Qwen-Plus', value: 'qwen-plus' },
                { label: 'Qwen-Max', value: 'qwen-max' },
                { label: 'GPT-4o', value: 'gpt-4o' },
                { label: 'GPT-4o-mini', value: 'gpt-4o-mini' },
              ]}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="is_active" label="启用" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_featured" label="精选" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default Agents
