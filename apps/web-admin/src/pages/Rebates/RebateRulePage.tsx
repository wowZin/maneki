/**
 * 返佣规则设置页
 */

import React, { useState, useEffect } from 'react'
import { Table, Card, Button, Space, Tag, Drawer, Form, Input, InputNumber, DatePicker, message, Popconfirm, Select, Row, Col, Divider, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined, ReloadOutlined, MinusCircleOutlined, PlusCircleOutlined , InfoCircleOutlined } from '@ant-design/icons'
import { adminApi } from '@/services/admin'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Text } = Typography

interface IncentiveRule {
  id?: number
  range_start: number
  range_end?: number | null
  coefficient: number
}

interface RebateRule {
  id: number
  name: string
  unit_price: number
  agent_id: number | null
  agent_name?: string
  start_at: string
  end_at: string
  status: 'active' | 'inactive'
  incentive_rules?: IncentiveRule[]
  created_at: string
}

const RebateRulePage: React.FC = () => {
  const [rules, setRules] = useState<RebateRule[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RebateRule | null>(null)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [form] = Form.useForm()

  useEffect(() => {
    fetchRules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize])

  const fetchRules = async () => {
    try {
      setLoading(true)
      const res = await adminApi.getRebateRules({ page: pagination.current, pageSize: pagination.pageSize })
      setRules(res.data || [])
      setPagination({ ...pagination, total: res.total || 0 })
    } catch {
      message.error('获取返佣规则失败')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingRule(null)
    form.resetFields()
    form.setFieldsValue({ unit_price: 5, status: 'active', incentive_rules: [{ range_start: 1, range_end: null, coefficient: 1 }] })
    setDrawerOpen(true)
  }

  const handleOpenEdit = (rule: RebateRule) => {
    setEditingRule(rule)
    form.setFieldsValue({
      name: rule.name,
      unit_price: rule.unit_price,
      agent_id: rule.agent_id,
      date_range: [dayjs(rule.start_at), dayjs(rule.end_at)],
      status: rule.status,
      incentive_rules: rule.incentive_rules?.length ? rule.incentive_rules.map(ir => ({ ...ir, range_end: ir.range_end ?? null })) : [{ range_start: 1, range_end: null, coefficient: 1 }],
    })
    setDrawerOpen(true)
  }

  const handleSubmit = async (values: any) => {
    try {
      const [start, end] = values.date_range || []
      const payload = {
        name: values.name,
        unit_price: values.unit_price,
        agent_id: values.agent_id || null,
        start_at: start?.format(),
        end_at: end?.format(),
        incentive_rules: (values.incentive_rules || []).map((ir: any) => ({ range_start: ir.range_start, range_end: ir.range_end || null, coefficient: ir.coefficient })),
      }
      if (editingRule) {
        await adminApi.updateRebateRule(editingRule.id, payload)
        message.success('规则更新成功')
      } else {
        await adminApi.createRebateRule(payload)
        message.success('规则创建成功')
      }
      setDrawerOpen(false)
      fetchRules()
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败')
    }
  }

  const handleToggleStatus = async (rule: RebateRule) => {
    try {
      const newStatus = rule.status === 'active' ? 'inactive' : 'active'
      await adminApi.toggleRebateRuleStatus(rule.id, newStatus)
      message.success('状态更新成功')
      fetchRules()
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteRebateRule(id)
      message.success('删除成功')
      fetchRules()
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '规则名称', dataIndex: 'name' },
    { title: '返佣单价', dataIndex: 'unit_price', render: (v: number) => `¥${v.toFixed(2)}` },
    {
      title: '适用对象', dataIndex: 'agent_id',
      render: (v: number | null, record: RebateRule) => v ? <Tag color="blue">Agent: {record.agent_name || v}</Tag> : <Tag color="green">全局默认</Tag>,
    },
    {
      title: '生效时间',
      render: (_: any, record: RebateRule) => (
        <span>{dayjs(record.start_at).format('YYYY-MM-DD')} ~ {dayjs(record.end_at).format('YYYY-MM-DD')}</span>
      ),
    },
    { title: '状态', dataIndex: 'status', render: (v: string) => v === 'active' ? <Tag color="success">启用</Tag> : <Tag>停用</Tag> },
    {
      title: '操作', width: 200,
      render: (_: any, record: RebateRule) => (
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
              <DollarOutlined />
            </span>
            返佣规则设置
          </h1>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            配置返佣单价、阶梯激励与生效范围</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchRules} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none">新增规则</Button>
        </Space>
      </div>

      <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
        <Table
          columns={columns}
          dataSource={rules}
          rowKey="id"
          loading={loading}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
          onChange={p => setPagination({ ...pagination, current: p.current || 1, pageSize: p.pageSize || 20 })}
        />
      </Card>

      <Drawer title={editingRule ? '编辑返佣规则' : '新增返佣规则'} width={600} open={drawerOpen} onClose={() => setDrawerOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="例如：默认全局返佣规则" />
          </Form.Item>

          <Form.Item name="unit_price" label="返佣单价（元/订阅）" rules={[{ required: true, message: '请输入返佣单价' }]}>
            <InputNumber min={0} precision={2} className="w-full" placeholder="5.00" />
          </Form.Item>

          <Form.Item name="agent_id" label="适用对象">
            <Select placeholder="不选表示全局默认" allowClear options={[]} showSearch disabled />
          </Form.Item>

          <Form.Item name="date_range" label="生效时间范围" rules={[{ required: true, message: '请选择生效时间范围' }]}>
            <RangePicker className="w-full" />
          </Form.Item>

          <Divider orientation="left">阶梯激励规则</Divider>
          <Text type="secondary" className="block mb-4">按单笔订阅数量分段设置激励系数，区间必须连续无间隙。默认系数为 1.0 表示无额外激励。</Text>

          <Form.List name="incentive_rules">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={16} align="middle" className="mb-2">
                    <Col span={7}>
                      <Form.Item {...restField} name={[name, 'range_start']} rules={[{ required: true, message: '必填' }]}>
                        <InputNumber min={1} placeholder="下限" className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={7}>
                      <Form.Item {...restField} name={[name, 'range_end']}>
                        <InputNumber min={1} placeholder="上限（空表示无上限）" className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={7}>
                      <Form.Item {...restField} name={[name, 'coefficient']} rules={[{ required: true, message: '必填' }]}>
                        <InputNumber min={0} precision={2} placeholder="系数" className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={3}>
                      <MinusCircleOutlined className="text-[var(--color-error)] text-lg cursor-pointer" onClick={() => remove(name)} />
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusCircleOutlined />}>添加激励区间</Button>
              </>
            )}
          </Form.List>

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

export default RebateRulePage