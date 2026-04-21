import React, { useState, useEffect } from 'react'
import { Card, Form, InputNumber, Button, Space, message } from 'antd'
import { SaveOutlined, ReloadOutlined, SettingOutlined , InfoCircleOutlined } from '@ant-design/icons'
import { adminApi } from '@/services/admin'

const SystemSettings: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchSettings() }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const data = await adminApi.getSettings()
      form.setFieldsValue(data)
    } catch {
      message.error('获取配置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (values: any) => {
    try {
      setSaving(true)
      await adminApi.updateSettings(values)
      message.success('配置保存成功')
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { name: ['system', 'monitor_stock_count'], label: '监控股票数量', min: 10, max: 1000, help: '系统同时监控的股票数量上限' },
    { name: ['system', 'signal_threshold'], label: '信号置信度阈值', min: 0, max: 1, precision: 2, help: 'Agent 信号触发阈值 (0-1)' },
    { name: ['system', 'data_retention_days'], label: '数据保留天数', min: 1, max: 365, help: '历史数据自动清理周期' },
    { name: ['system', 'agent_discussion_timeout'], label: 'Agent 讨论超时（分钟）', min: 1, max: 60, help: '多 Agent 协同讨论最大等待时间' },
    { name: ['system', 'max_agents'], label: '最大 Agent 数量', min: 1, max: 50, help: '单个用户可创建的最大 Agent 数' },
  ]

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
          <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
            <SettingOutlined />
          </span>
          元信息配置
        </h1>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            管理系统核心运行参数，修改后即时生效</p>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSave} disabled={loading}>
        <Card
          className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]"
          style={{ minHeight: '500px' }}
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchSettings} loading={loading}>刷新</Button>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}
                className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none"
              >保存配置</Button>
            </Space>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
            {fields.map((f) => (
              <Form.Item
                key={f.name.join('.')}
                name={f.name}
                label={<span className="font-medium text-[var(--color-text-primary)]">{f.label}</span>}
                rules={[{ required: true }]}
                help={<span className="text-xs text-[var(--color-text-tertiary)]">{f.help}</span>}
              >
                <InputNumber min={f.min} max={f.max} precision={f.precision} style={{ width: '100%' }} />
              </Form.Item>
            ))}
          </div>
        </Card>
      </Form>
    </div>
  )
}

export default SystemSettings
