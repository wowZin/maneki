/**
 * 元配置页面
 */

import React, { useState, useEffect } from 'react'
import {
  Card,
  Form,
  InputNumber,
  Button,
  Space,
  Alert,
  message,
} from 'antd'
import {
  SaveOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { adminApi } from '@/services/admin'

const SystemSettings: React.FC = () => {
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
        <SettingOutlined /> 元配置
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
            message="元配置"
            description="修改系统级配置可能影响整个应用的运行，请谨慎操作。"
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form.Item
            name={['system', 'monitor_stock_count']}
            label="监控股票数量"
            rules={[{ required: true }]}
          >
            <InputNumber min={10} max={1000} style={{ width: 200 }} />
          </Form.Item>

          <Form.Item
            name={['system', 'signal_threshold']}
            label="信号置信度阈值"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} max={1} precision={2} style={{ width: 200 }} />
          </Form.Item>

          <Form.Item
            name={['system', 'data_retention_days']}
            label="数据保留天数"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={365} style={{ width: 200 }}  />
          </Form.Item>

          <Form.Item
            name={['system', 'agent_discussion_timeout']}
            label="Agent 讨论超时时间"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={60} style={{ width: 200 }}  />
          </Form.Item>

          <Form.Item
            name={['system', 'max_agents']}
            label="最大 Agent 数量"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={50} style={{ width: 200 }} />
          </Form.Item>
        </Card>
      </Form>
    </div>
  )
}

export default SystemSettings