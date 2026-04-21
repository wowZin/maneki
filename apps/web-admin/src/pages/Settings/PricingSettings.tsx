/**
 * 定价配置页面
 */

import React, { useState, useEffect } from 'react'
import {
  Card,
  Form,
  InputNumber,
  Switch,
  Button,
  Space,
  Alert,
  Divider,
  message,
} from 'antd'
import {
  SaveOutlined,
  ReloadOutlined,
  DollarOutlined,
} from '@ant-design/icons'
import { adminApi } from '@/services/admin'

const PricingSettings: React.FC = () => {
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
    } catch (error) {
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
    } catch (error) {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>
        <DollarOutlined /> 定价配置
      </h2>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Card
          extra={
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchSettings}
                loading={loading}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={saving}
              >
                保存配置
              </Button>
            </Space>
          }
        >
          <Alert
            message="定价配置"
            description="配置各会员等级的价格。修改后新订单将使用新价格，已有订单不受影响。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <h4>VIP 会员价格</h4>
          <Space style={{ marginBottom: 16 }}>
            <Form.Item
              name={['pricing', 'vip', 'monthly']}
              label="月付"
              rules={[{ required: true }]}
            >
              <InputNumber min={0} precision={2} addonBefore="¥" />
            </Form.Item>
            <Form.Item
              name={['pricing', 'vip', 'quarterly']}
              label="季付"
              rules={[{ required: true }]}
            >
              <InputNumber min={0} precision={2} addonBefore="¥" />
            </Form.Item>
            <Form.Item
              name={['pricing', 'vip', 'yearly']}
              label="年付"
              rules={[{ required: true }]}
            >
              <InputNumber min={0} precision={2} addonBefore="¥" />
            </Form.Item>
          </Space>

          <Divider />

          <h4>SVIP 会员价格</h4>
          <Space>
            <Form.Item
              name={['pricing', 'svip', 'monthly']}
              label="月付"
              rules={[{ required: true }]}
            >
              <InputNumber min={0} precision={2} addonBefore="¥" />
            </Form.Item>
            <Form.Item
              name={['pricing', 'svip', 'quarterly']}
              label="季付"
              rules={[{ required: true }]}
            >
              <InputNumber min={0} precision={2} addonBefore="¥" />
            </Form.Item>
            <Form.Item
              name={['pricing', 'svip', 'yearly']}
              label="年付"
              rules={[{ required: true }]}
            >
              <InputNumber min={0} precision={2} addonBefore="¥" />
            </Form.Item>
          </Space>

          <Divider />

          <Form.Item
            name={['pricing', 'global_discount_enabled']}
            label="启用全局折扣"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name={['pricing', 'global_discount_rate']}
            label="全局折扣率"
            rules={[{ required: true }]}
          >
            <InputNumber
              min={0.1}
              max={1}
              precision={2}
              style={{ width: 200 }}
              
            />
          </Form.Item>
        </Card>
      </Form>
    </div>
  )
}

export default PricingSettings
