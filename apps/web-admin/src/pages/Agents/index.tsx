/**
 * Agent 管理 - 列表页
 */

import React, { useState, useEffect } from 'react'
import {
  Table, Card, Button, Input, Space, Tag, Modal, Form, Select, Switch, message, Popconfirm, Avatar, Tooltip,
} from 'antd'
import {
  SearchOutlined, EditOutlined, StarOutlined, CheckCircleOutlined, StopOutlined, PlusOutlined, DeleteOutlined,

  InfoCircleOutlined,
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

const typeLabels: Record<string, string> = {
  technical: '技术面', fundamental: '基本面', sentiment: '情绪面', capital: '资金面', decision: '决策', custom: '自定义',
}
const categoryColors: Record<string, string> = {
  trend: 'blue', volume: 'green', breakout: 'orange', sentiment: 'purple', custom: 'default',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setPagination(prev => ({ ...prev, total: data.total }))
    } catch {
      message.error('获取 Agent 列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }))
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
    if (!editingAgent) return
    try {
      await adminApi.updateAgentTemplate(String(editingAgent.id), values)
      message.success('Agent 更新成功')
      setIsEditModalOpen(false)
      fetchAgents()
    } catch {
      message.error('更新失败')
    }
  }

  const handleToggleFeatured = async (agent: AgentItem) => {
    try {
      await adminApi.updateAgentTemplate(String(agent.id), { is_featured: !agent.is_featured })
      message.success(agent.is_featured ? '已取消精选' : '已设为精选')
      fetchAgents()
    } catch {
      message.error('操作失败')
    }
  }

  const handleDelete = async (agent: AgentItem) => {
    try {
      await adminApi.deleteAgent(String(agent.id))
      message.success('删除成功')
      fetchAgents()
    } catch {
      message.error('删除失败')
    }
  }

  const columns = [
    {
      title: 'Agent',
      key: 'agent',
      render: (agent: AgentItem) => (
        <Space>
          <Avatar className="!bg-[#8b5cf6]">{agent.name[0]?.toUpperCase()}</Avatar>
          <div>
            <div className="font-medium">{agent.name}</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">
              {agent.description?.slice(0, 30) || '无描述'}
              {agent.description && agent.description.length > 30 ? '...' : ''}
            </div>
          </div>
        </Space>
      ),
    },
    { title: '类型', dataIndex: 'type', key: 'type', render: (type: string) => <Tag>{typeLabels[type] || type}</Tag> },
    { title: '分类', dataIndex: 'category', key: 'category', render: (c: string) => <Tag color={categoryColors[c] || 'default'}>{c || '-'}</Tag> },
    { title: '模型', dataIndex: 'model', key: 'model', render: (m: string) => m || '-' },
    {
      title: '状态',
      key: 'status',
      render: (agent: AgentItem) => (
        <Space>
          {agent.is_active ? <Tag color="success">启用</Tag> : <Tag color="default">停用</Tag>}
          {agent.is_featured && <Tag color="gold" icon={<StarOutlined />}>精选</Tag>}
          {agent.is_official && <Tag color="blue">官方</Tag>}
        </Space>
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm') },
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
            description={agent.is_featured ? '确定要取消该 Agent 的精选状态吗？' : '设为精选后，该 Agent 将对免费用户可见。'}
            onConfirm={() => handleToggleFeatured(agent)}
          >
            <Button type="text" icon={agent.is_featured ? <StopOutlined /> : <CheckCircleOutlined />}>
              {agent.is_featured ? '取消精选' : '精选'}
            </Button>
          </Popconfirm>
          <Popconfirm title="删除 Agent" description="确定要删除该 Agent 吗？此操作不可恢复。" onConfirm={() => handleDelete(agent)}>
            <Button type="text" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const stats = {
    total: pagination.total,
    active: agents.filter(a => a.is_active).length,
    featured: agents.filter(a => a.is_featured).length,
    totalUsage: agents.reduce((sum, a) => sum + (a.use_count || 0), 0),
  }

  const statVariants = [
    { label: 'Agent 总数', value: stats.total, bar: 'from-[#7c3aed] to-[#a78bfa]', iconBg: 'bg-[#f5f3ff]', iconText: 'text-[#5b21b6]' },
    { label: '启用 Agent', value: stats.active, bar: 'from-[#10b981] to-[#34d399]', iconBg: 'bg-[#ecfdf5]', iconText: 'text-[#059669]' },
    { label: '精选 Agent', value: stats.featured, bar: 'from-[#f59e0b] to-[#fbbf24]', iconBg: 'bg-[#fffbeb]', iconText: 'text-[#b45309]' },
    { label: '总使用次数', value: stats.totalUsage, bar: 'from-[#3b82f6] to-[#60a5fa]', iconBg: 'bg-[#eff6ff]', iconText: 'text-[#1d4ed8]' },
  ]

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0">Agent 管理</h1>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            管理平台 Agent 模板与状态</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/agents/create')}
          className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none"
        >新增 Agent</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statVariants.map((s, i) => (
          <div key={i} className="relative overflow-hidden bg-white border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
            <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${s.bar}`} />
            <div className={`w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center text-lg mb-3 ${s.iconBg} ${s.iconText}`}>
              {i === 0 ? <span className="font-bold">A</span> : i === 1 ? <CheckCircleOutlined /> : i === 2 ? <StarOutlined /> : <span className="font-bold">#</span>}
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)] leading-tight tracking-tight">{s.value}</div>
            <div className="text-[13px] text-[var(--color-text-secondary)] mt-1 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      <Card
        className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]"
        title={<span className="font-semibold">Agent 列表</span>}
        extra={
          <Space>
            <Input
              placeholder="搜索名称/描述"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              style={{ width: 250 }}
              allowClear
            />
            <Button type="primary" onClick={handleSearch}
              className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none"
            >搜索</Button>
          </Space>
        }
      >
        <Table
          columns={columns as any}
          dataSource={agents}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 条`,
          }}
          onChange={p => setPagination(prev => ({ ...prev, current: p.current || 1, pageSize: p.pageSize || 20 }))}
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
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入 Agent 名称' }]}>
            <Input maxLength={30} showCount />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} maxLength={300} showCount />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={Object.entries(typeLabels).map(([v, l]) => ({ label: l, value: v }))} />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select allowClear options={Object.entries(categoryColors).map(([v]) => ({ label: v, value: v }))} />
          </Form.Item>
          <Form.Item name="prompt" label="提示词">
            <Input.TextArea rows={4} placeholder="支持 Markdown 格式" />
          </Form.Item>
          <Form.Item name="model" label="模型">
            <Select allowClear placeholder="请选择模型" options={[
              { label: 'Qwen-Turbo', value: 'qwen-turbo' },
              { label: 'Qwen-Plus', value: 'qwen-plus' },
              { label: 'Qwen-Max', value: 'qwen-max' },
              { label: 'GPT-4o', value: 'gpt-4o' },
              { label: 'GPT-4o-mini', value: 'gpt-4o-mini' },
            ]} />
          </Form.Item>
          <div className="flex gap-6">
            <Form.Item name="is_active" label="启用" valuePropName="checked" className="!mb-0">
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
            <Form.Item name="is_featured" label="精选" valuePropName="checked" className="!mb-0">
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default Agents