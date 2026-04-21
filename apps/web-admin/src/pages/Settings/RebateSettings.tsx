/**
 * 返佣配置页面
 */

import React, { useState, useEffect } from 'react'
import { Card, Form, InputNumber, Switch, Button, Space, Tooltip, Alert, message } from 'antd'
import { SaveOutlined, ReloadOutlined, QuestionCircleOutlined, GiftOutlined , InfoCircleOutlined } from '@ant-design/icons'
import { adminApi } from '@/services/admin'

const RebateSettings: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

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

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
          <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
            <GiftOutlined />
          </span>
          返佣配置
        </h1>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            配置返佣金额、结算周期与上限规则</p>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]"
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchSettings} loading={loading}>刷新</Button>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving} className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none">保存配置</Button>
            </Space>
          }
        >
          <Alert message="返佣配置说明" description="当用户通过 Agent 订阅 VIP 时，Agent 的创建者将获得一次性返佣。返佣将在退款期过后结算。" type="info" showIcon className="mb-4" />

          <Form.Item name={['rebate', 'enabled']} label="启用返佣" valuePropName="checked" tooltip="关闭后新订阅不再产生返佣">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item name={['rebate', 'amount']} label={<Space>返佣金额<Tooltip title="单次订阅的返佣金额（元）"><QuestionCircleOutlined /></Tooltip></Space>} rules={[{ required: true, message: '请输入返佣金额' }]}>
            <InputNumber min={0} max={1000} precision={2} className="w-[200px]" addonBefore="¥" />
          </Form.Item>

          <Form.Item name={['rebate', 'min_vip_days']} label={<Space>最小订阅天数<Tooltip title="只有订阅天数超过此值才触发返佣，防止短期套利"><QuestionCircleOutlined /></Tooltip></Space>} rules={[{ required: true, message: '请输入最小天数' }]}>
            <InputNumber min={1} max={365} className="w-[200px]" />
          </Form.Item>

          <Form.Item name={['rebate', 'settlement_days']} label={<Space>结算周期<Tooltip title="退款期过后的天数才结算返佣"><QuestionCircleOutlined /></Tooltip></Space>} rules={[{ required: true, message: '请输入结算周期' }]}>
            <InputNumber min={0} max={30} className="w-[200px]" />
          </Form.Item>

          <Form.Item name={['rebate', 'max_per_month']} label={<Space>月返佣上限<Tooltip title="单个 Agent Owner 每月最大返佣金额"><QuestionCircleOutlined /></Tooltip></Space>}>
            <InputNumber min={0} className="w-[200px]" addonBefore="¥" />
          </Form.Item>
        </Card>
      </Form>
    </div>
  )
}

export default RebateSettings
