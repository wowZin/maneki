import React, { useState, useEffect } from 'react'
import {
  Form,
  InputNumber,
  Button,
  message,
  Tag,
} from 'antd'
import {
  SaveOutlined,
  ReloadOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  CrownOutlined,
  StarOutlined,
} from '@ant-design/icons'
import { adminApi } from '@/services/admin'

interface TierCardProps {
  title: string
  icon: React.ReactNode
  color: string
  namePrefix: string
  form: any
}

const TierCard: React.FC<TierCardProps> = ({ title, icon, color, namePrefix, form }) => {
  const periods = [
    { key: 'monthly', label: '月付', shortcut: '1个月' },
    { key: 'quarterly', label: '季付', shortcut: '3个月' },
    { key: 'yearly', label: '年付', shortcut: '12个月' },
  ]

  return (
    <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border-light)] flex items-center gap-2.5" style={{ background: `${color}08` }}>
        <span className="w-7 h-7 rounded-md flex items-center justify-center text-white text-sm" style={{ background: color }}>
          {icon}
        </span>
        <span className="text-sm font-bold text-[var(--color-text-primary)]">{title}</span>
      </div>

      <div className="divide-y divide-[var(--color-border-light)]">
        {periods.map((p) => {
          const price = Form.useWatch([namePrefix, p.key, 'price'], form) || 0
          const discount = Form.useWatch([namePrefix, p.key, 'discount'], form) || 1
          const final = (price * discount).toFixed(2)

          return (
            <div key={p.key} className="px-5 py-3.5 flex items-center gap-4 hover:bg-[var(--color-bg-body)] transition-colors">
              <div className="w-14 shrink-0">
                <div className="text-xs font-bold text-[var(--color-text-primary)]">{p.label}</div>
                <div className="text-[11px] text-[var(--color-text-tertiary)]">{p.shortcut}</div>
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Form.Item
                  name={[namePrefix, p.key, 'price']}
                  rules={[{ required: true, message: '价格' }]}
                  className="!mb-0"
                >
                  <InputNumber
                    min={0}
                    precision={2}
                    addonBefore="¥"
                    style={{ width: 120 }}
                    size="small"
                  />
                </Form.Item>

                <span className="text-[var(--color-text-tertiary)] text-xs">×</span>

                <Form.Item
                  name={[namePrefix, p.key, 'discount']}
                  rules={[
                    { required: true, message: '折扣' },
                    { type: 'number', min: 0.1, max: 1, message: '0.1~1' },
                  ]}
                  className="!mb-0"
                >
                  <InputNumber
                    min={0.1}
                    max={1}
                    precision={2}
                    style={{ width: 90 }}
                    size="small"
                    addonAfter="折"
                  />
                </Form.Item>

                <span className="text-[var(--color-text-tertiary)] text-xs">=</span>

                <Tag color="success" className="!m-0 !text-xs !px-2 !py-0.5">
                  ¥{final}
                </Tag>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
      const data = await adminApi.getPricingSettings()
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
      await adminApi.updatePricingSettings(values)
      message.success('配置保存成功')
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
            <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
              <DollarOutlined />
            </span>
            定价配置
          </h1>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            修改后新订单将使用新价格，已有订单不受影响
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<ReloadOutlined />} onClick={fetchSettings} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            htmlType="submit"
            loading={saving}
            onClick={() => form.submit()}
            className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none"
          >
            保存配置
          </Button>
        </div>
      </div>

      <Form form={form} onFinish={handleSave} disabled={loading}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TierCard
            title="VIP 会员价格"
            icon={<StarOutlined />}
            color="#7c3aed"
            namePrefix="vip"
            form={form}
          />
          <TierCard
            title="SVIP 会员价格"
            icon={<CrownOutlined />}
            color="#f59e0b"
            namePrefix="svip"
            form={form}
          />
        </div>
      </Form>
    </div>
  )
}

export default PricingSettings
