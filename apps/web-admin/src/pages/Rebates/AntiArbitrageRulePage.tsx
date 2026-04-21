/**
 * 防套利规则设置页
 */

import React, { useState, useEffect } from 'react'
import { Table, Card, Button, Space, Tag, Drawer, Form, Input, Select, InputNumber, message, Popconfirm, Typography, Divider } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined, ReloadOutlined , InfoCircleOutlined } from '@ant-design/icons'
import { adminApi } from '@/services/admin'

const { Text } = Typography

interface AntiArbitrageRule {
  id: number
  name: string
  strategy_type: string
  rule_params: Record<string, any>
  action: 'block' | 'review'
  status: 'active' | 'inactive'
  priority: number
  created_at: string
}

const strategyTypeMap: Record<string, string> = {
  self_subscribe: '创作者自订阅拦截',
  ip_freq: 'IP 频次限制',
  new_user_threshold: '新用户阈值',
  linked_account: '关联账号检测',
}

const actionMap: Record<string, { text: string; color: string }> = {
  block: { text: '直接拦截', color: 'red' },
  review: { text: '标记待审', color: 'orange' },
}

const AntiArbitrageRulePage: React.FC = () => {
  const [rules, setRules] = useState<AntiArbitrageRule[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AntiArbitrageRule | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      setLoading(true)
      const res = await adminApi.getAntiArbitrageRules({})
      setRules(res.data || [])
    } catch {
      message.error('获取防套利规则失败')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingRule(null)
    form.resetFields()
    form.setFieldsValue({ strategy_type: 'ip_freq', action: 'block', priority: 10, rule_params: { window_hours: 24, max_count: 3 } })
    setDrawerOpen(true)
  }

  const handleOpenEdit = (rule: AntiArbitrageRule) => {
    setEditingRule(rule)
    form.setFieldsValue({ name: rule.name, strategy_type: rule.strategy_type, action: rule.action, priority: rule.priority, rule_params: rule.rule_params })
    setDrawerOpen(true)
  }

  const handleSubmit = async (values: any) => {
    try {
      const payload = { name: values.name, strategy_type: values.strategy_type, action: values.action, priority: values.priority, rule_params: values.rule_params }
      if (editingRule) {
        await adminApi.updateAntiArbitrageRule(editingRule.id, payload)
        message.success('规则更新成功')
      } else {
        await adminApi.createAntiArbitrageRule(payload)
        message.success('规则创建成功')
      }
      setDrawerOpen(false)
      fetchRules()
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败')
    }
  }

  const handleToggleStatus = async (rule: AntiArbitrageRule) => {
    try {
      const newStatus = rule.status === 'active' ? 'inactive' : 'active'
      await adminApi.toggleAntiArbitrageRuleStatus(rule.id, newStatus)
      message.success('状态更新成功')
      fetchRules()
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteAntiArbitrageRule(id)
      message.success('删除成功')
      fetchRules()
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败')
    }
  }

  const strategyType = Form.useWatch('strategy_type', form)

  const renderRuleParamsForm = () => {
    switch (strategyType) {
      case 'ip_freq':
        return (
          <>
            <Form.Item label="时间窗口（小时）" name={['rule_params', 'window_hours']}><InputNumber min={1} className="w-full" /></Form.Item>
            <Form.Item label="最大次数" name={['rule_params', 'max_count']}><InputNumber min={1} className="w-full" /></Form.Item>
          </>
        )
      case 'new_user_threshold':
        return (
          <>
            <Form.Item label="时间窗口（天）" name={['rule_params', 'window_days']}><InputNumber min={1} className="w-full" /></Form.Item>
            <Form.Item label="最大订阅数" name={['rule_params', 'max_subscriptions']}><InputNumber min={1} className="w-full" /></Form.Item>
          </>
        )
      default:
        return <Text type="secondary">该策略类型无需额外参数</Text>
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '规则名称', dataIndex: 'name' },
    { title: '策略类型', dataIndex: 'strategy_type', render: (v: string) => <Tag>{strategyTypeMap[v] || v}</Tag> },
    { title: '处理动作', dataIndex: 'action', render: (v: string) => { const config = actionMap[v]; return <Tag color={config.color}>{config.text}</Tag> } },
    { title: '优先级', dataIndex: 'priority', width: 80 },
    { title: '状态', dataIndex: 'status', render: (v: string) => v === 'active' ? <Tag color="success">启用</Tag> : <Tag>停用</Tag> },
    {
      title: '操作', width: 200,
      render: (_: any, record: AntiArbitrageRule) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)}>编辑</Button>
          <Button size="small" type={record.status === 'active' ? 'default' : 'primary'} onClick={() => handleToggleStatus(record)}>
            {record.status === 'active' ? '停用' : '启用'}
          </Button>
          <Popconfirm title="确定删除此规则？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
            <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
              <SafetyOutlined />
            </span>
            防套利规则设置
          </h1>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            配置反作弊策略与拦截规则</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchRules} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none">新增规则</Button>
        </Space>
      </div>

      <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
        <Table columns={columns} dataSource={rules} rowKey="id" loading={loading} pagination={false} />
      </Card>

      <Drawer title={editingRule ? '编辑防套利规则' : '新增防套利规则'} width={500} open={drawerOpen} onClose={() => setDrawerOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="例如：同一IP 24小时限制" />
          </Form.Item>

          <Form.Item name="strategy_type" label="策略类型" rules={[{ required: true }]}>
            <Select options={[
              { label: '创作者自订阅拦截', value: 'self_subscribe' },
              { label: 'IP 频次限制', value: 'ip_freq' },
              { label: '新用户阈值', value: 'new_user_threshold' },
              { label: '关联账号检测', value: 'linked_account' },
            ]} />
          </Form.Item>

          <Form.Item name="action" label="处理动作" rules={[{ required: true }]}>
            <Select options={[
              { label: '直接拦截（返佣记为0）', value: 'block' },
              { label: '标记待审（进入人工审核）', value: 'review' },
            ]} />
          </Form.Item>

          <Form.Item name="priority" label="优先级"><InputNumber min={0} className="w-full" /></Form.Item>

          <Divider orientation="left">规则参数</Divider>
          {renderRuleParamsForm()}

          <Divider />

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">保存</Button>
              <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}

export default AntiArbitrageRulePage