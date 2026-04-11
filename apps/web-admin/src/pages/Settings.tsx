/**
 * 系统配置页面
 */

import React, { useState, useEffect } from 'react'
import {
  Card,
  Form,
  InputNumber,
  Switch,
  Button,
  message,
  Tabs,
  Divider,
  Space,
  Tooltip,
  Alert,
} from 'antd'
import {
  SaveOutlined,
  ReloadOutlined,
  QuestionCircleOutlined,
  DollarOutlined,
  SettingOutlined,
  BellOutlined,
} from '@ant-design/icons'
import { adminApi } from '@/services/admin'

const { TabPane } = Tabs

const Settings: React.FC = () => {
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

  const rebateConfigItems = (
    <>
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
          addonAfter="天"
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
          addonAfter="天"
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
    </>
  )

  const pricingConfigItems = (
    <>
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
          addonAfter="折"
        />
      </Form.Item>
    </>
  )

  const systemConfigItems = (
    <>
      <Alert
        message="系统配置"
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
        <InputNumber min={1} max={365} style={{ width: 200 }} addonAfter="天" />
      </Form.Item>

      <Form.Item
        name={['system', 'agent_discussion_timeout']}
        label="Agent 讨论超时时间"
        rules={[{ required: true }]}
      >
        <InputNumber min={1} max={60} style={{ width: 200 }} addonAfter="秒" />
      </Form.Item>

      <Form.Item
        name={['system', 'max_agents']}
        label="最大 Agent 数量"
        rules={[{ required: true }]}
      >
        <InputNumber min={1} max={50} style={{ width: 200 }} />
      </Form.Item>
    </>
  )

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>系统配置</h2>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
      >
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
          <Tabs defaultActiveKey="rebate">
            <TabPane
              tab={
                <Space>
                  <DollarOutlined />
                  返佣配置
                </Space>
              }
              key="rebate"
            >
              {rebateConfigItems}
            </TabPane>

            <TabPane
              tab={
                <Space>
                  <DollarOutlined />
                  定价配置
                </Space>
              }
              key="pricing"
            >
              {pricingConfigItems}
            </TabPane>

            <TabPane
              tab={
                <Space>
                  <SettingOutlined />
                  系统配置
                </Space>
              }
              key="system"
            >
              {systemConfigItems}
            </TabPane>

            <TabPane
              tab={
                <Space>
                  <BellOutlined />
                  通知配置
                </Space>
              }
              key="notification"
            >
              <Alert
                message="开发中"
                description="通知配置功能正在开发中"
                type="info"
              />
            </TabPane>
          </Tabs>
        </Card>
      </Form>
    </div>
  )
}

export default Settings