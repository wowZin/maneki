/**
 * 返佣配置页面
 */

import React, { useState, useEffect } from 'react'
import {
  Card,
  Form,
  InputNumber,
  Switch,
  Button,
  Space,
  Tooltip,
  Alert,
  message,
} from 'antd'
import {
  SaveOutlined,
  ReloadOutlined,
  QuestionCircleOutlined,
  GiftOutlined,
} from '@ant-design/icons'
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
        <GiftOutlined /> 返佣配置
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
            message="返佣配置说明"
            description="当用户通过 Agent 订阅 VIP 时，Agent 的创建者将获得一次性返佣。返佣将在退款期过后结算。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form.Item
            name={['rebate', 'enabled']}
            label="启用返佣"
            valuePropName="checked"
            tooltip="关闭后新订阅不再产生返佣"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item
            name={['rebate', 'amount']}
            label={
              <Space>
                返佣金额
                <Tooltip title="单次订阅的返佣金额（元）">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            rules={[{ required: true, message: '请输入返佣金额' }]}
          >
            <InputNumber
              min={0}
              max={1000}
              precision={2}
              style={{ width: 200 }}
              addonBefore="¥"
            />
          </Form.Item>

          <Form.Item
            name={['rebate', 'min_vip_days']}
            label={
              <Space>
                最小订阅天数
                <Tooltip title="只有订阅天数超过此值才触发返佣，防止短期套利">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            rules={[{ required: true, message: '请输入最小天数' }]}
          >
            <InputNumber
              min={1}
              max={365}
              style={{ width: 200 }}
              
            />
          </Form.Item>

          <Form.Item
            name={['rebate', 'settlement_days']}
            label={
              <Space>
                结算周期
                <Tooltip title="退款期过后的天数才结算返佣">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            rules={[{ required: true, message: '请输入结算周期' }]}
          >
            <InputNumber
              min={0}
              max={30}
              style={{ width: 200 }}
              
            />
          </Form.Item>

          <Form.Item
            name={['rebate', 'max_per_month']}
            label={
              <Space>
                月返佣上限
                <Tooltip title="单个 Agent Owner 每月最大返佣金额">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
          >
            <InputNumber
              min={0}
              style={{ width: 200 }}
              addonBefore="¥"
            />
          </Form.Item>
        </Card>
      </Form>
    </div>
  )
}

export default RebateSettings
