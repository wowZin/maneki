/**
 * Agent 管理页面
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
} from 'antd'
import {
  SearchOutlined,
  EditOutlined,
  StarOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { adminApi } from '../../services/admin'
import dayjs from 'dayjs'

interface AgentTemplate {
  id: string
  name: string
  description?: string
  category: string
  is_public: boolean
  is_featured: boolean
  creator_email: string
  usage_count: number
  rating: number
  rating_count: number
  created_at: string
}

const Agents: React.FC = () => {
  const [agents, setAgents] = useState<AgentTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [searchText, setSearchText] = useState('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentTemplate | null>(null)
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
      setAgents(data.items)
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

  const handleEdit = (agent: AgentTemplate) => {
    setEditingAgent(agent)
    form.setFieldsValue({
      name: agent.name,
      description: agent.description,
      category: agent.category,
      is_public: agent.is_public,
      is_featured: agent.is_featured,
    })
    setIsEditModalOpen(true)
  }

  const handleSave = async (values: any) => {
    try {
      if (!editingAgent) return

      await adminApi.updateAgentTemplate(editingAgent.id, values)
      message.success('Agent 更新成功')
      setIsEditModalOpen(false)
      fetchAgents()
    } catch (error) {
      message.error('更新失败')
    }
  }

  const handleToggleFeatured = async (agent: AgentTemplate) => {
    try {
      await adminApi.updateAgentTemplate(agent.id, {
        is_featured: !agent.is_featured,
      })
      message.success(agent.is_featured ? '已取消精选' : '已设为精选')
      fetchAgents()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const columns = [
    {
      title: 'Agent',
      key: 'agent',
      render: (agent: AgentTemplate) => (
        <Space>
          <Avatar style={{ backgroundColor: '#8b5cf6' }}>
            {agent.name[0].toUpperCase()}
          </Avatar>
          <div>
            <div>{agent.name}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {agent.description?.slice(0, 30) || '无描述'}...
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: '创建者',
      dataIndex: 'creator_email',
      key: 'creator_email',
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
        return <Tag color={colors[category] || 'default'}>{category}</Tag>
      },
    },
    {
      title: '评分',
      key: 'rating',
      render: (agent: AgentTemplate) => (
        <Space>
          <Rate disabled defaultValue={agent.rating} allowHalf />
          <span>({agent.rating_count})</span>
        </Space>
      ),
    },
    {
      title: '使用量',
      dataIndex: 'usage_count',
      key: 'usage_count',
    },
    {
      title: '状态',
      key: 'status',
      render: (agent: AgentTemplate) => (
        <Space>
          {agent.is_public && <Tag color="success">公开</Tag>}
          {agent.is_featured && (
            <Tag color="gold" icon={<StarOutlined />}>
              精选
            </Tag>
          )}
          {!agent.is_public && <Tag>私有</Tag>}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '操作',
      key: 'action',
      render: (agent: AgentTemplate) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(agent)}>
            编辑
          </Button>
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
              {agent.is_featured ? '取消精选' : '设为精选'}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Agent 管理</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Agent 总数" value={pagination.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="公开 Agent" value={0} valueStyle={{ color: '#10b981' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="精选 Agent" value={0} valueStyle={{ color: '#f59e0b' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总使用次数" value={0} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Agent 列表"
        extra={
          <Space>
            <Input
              placeholder="搜索名称/创建者"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              style={{ width: 250 }}
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
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="category" label="分类">
            <Select
              options={[
                { label: '趋势', value: 'trend' },
                { label: '量能', value: 'volume' },
                { label: '突破', value: 'breakout' },
                { label: '情绪', value: 'sentiment' },
                { label: '自定义', value: 'custom' },
              ]}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="is_public" label="公开" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={12}>
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
