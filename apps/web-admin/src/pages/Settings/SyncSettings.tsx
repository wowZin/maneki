/**
 * 新闻同步设置（作为 DataSourceSettings 的子组件）
 */
import React, { useState, useEffect } from 'react'
import { Form, Radio, Select, TimePicker, Button, Space, message, InputNumber, Tag, Card, Divider } from 'antd'
import { SaveOutlined, DatabaseOutlined, PlusOutlined, MinusCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { datasourceApi } from '../../services/datasource'

const { Option } = Select

interface NewsSyncSettingsData {
  time_mode: 'fixed' | 'interval'
  fixed_times: string[]
  interval_hours: number
  sources: string[]
}

const NewsSyncSettings: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [timeMode, setTimeMode] = useState<'fixed' | 'interval'>('interval')

  const sourceOptions = [
    { value: 'global_futu', label: '富途牛牛', color: 'purple' },
    { value: 'global_ths', label: '同花顺', color: 'orange' },
    { value: 'global_cls', label: '财联社', color: 'cyan' },
    { value: 'global_sina', label: '新浪财经', color: 'blue' },
  ]

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const result = await datasourceApi.getNewsSyncSettings()
      if (result.code === 0) {
        const data = result.data
        setTimeMode(data.time_mode)
        const fixedTimes = data.fixed_times?.map((t: string) => dayjs(t, 'HH:mm')) || []
        form.setFieldsValue({
          time_mode: data.time_mode, fixed_times: fixedTimes, interval_hours: data.interval_hours || 1,
          sources: data.sources || sourceOptions.map(s => s.value),
        })
      }
    } catch {
      message.error('获取设置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      const fixedTimes = values.fixed_times?.map((t: dayjs.Dayjs) => t.format('HH:mm')) || []
      const data: NewsSyncSettingsData = { time_mode: values.time_mode, fixed_times: fixedTimes, interval_hours: values.interval_hours, sources: values.sources }
      const result = await datasourceApi.saveNewsSyncSettings(data)
      if (result.code === 0) message.success('设置已保存')
      else message.error(result.message || '保存失败')
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ time_mode: 'interval', interval_hours: 1, sources: sourceOptions.map(s => s.value) }} className="max-w-3xl" disabled={loading}>
      <Card type="inner" title={<Space><ClockCircleOutlined /><span>同步时间设置</span></Space>} className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)] mb-4">
        <Form.Item name="time_mode" label="同步模式" rules={[{ required: true, message: '请选择同步模式' }]}>
          <Radio.Group onChange={e => setTimeMode(e.target.value)}>
            <Radio value="fixed">固定时间模式</Radio>
            <Radio value="interval">间隔时间模式</Radio>
          </Radio.Group>
        </Form.Item>

        {timeMode === 'fixed' ? (
          <Form.Item label="同步时段" required help="设置在哪些时间点自动同步新闻数据">
            <Form.List name="fixed_times" rules={[{ validator: async (_, value) => { if (!value || value.length === 0) return Promise.reject(new Error('请至少添加一个同步时间')) } }]}>
              {(fields, { add, remove }, { errors }) => (
                <>
                  {fields.map(field => (
                    <Space key={field.key} align="baseline">
                      <Form.Item {...field} validateTrigger={['onChange', 'onBlur']} rules={[{ required: true, message: '请选择时间' }, { validator: (_, value) => { if (!value || !dayjs.isDayjs(value)) return Promise.reject(new Error('请选择有效时间')); return Promise.resolve() } }]} noStyle>
                        <TimePicker format="HH:mm" placeholder="选择时间" />
                      </Form.Item>
                      {fields.length > 1 && <MinusCircleOutlined className="text-[var(--color-text-tertiary)] cursor-pointer" onClick={() => remove(field.name)} />}
                    </Space>
                  ))}
                  <Form.Item><Button type="dashed" onClick={() => add(dayjs('08:00', 'HH:mm'))} icon={<PlusOutlined />}>添加时段</Button><Form.ErrorList errors={errors} /></Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
        ) : (
          <Form.Item name="interval_hours" label="间隔时间" rules={[{ required: true, message: '请输入间隔时间' }, { type: 'number', min: 1, max: 24, message: '间隔时间必须在 1-24 小时之间' }]} help="每隔多少小时自动同步一次新闻数据">
            <Space.Compact><InputNumber min={1} max={24} className="w-[120px]" /><Button disabled>小时</Button></Space.Compact>
          </Form.Item>
        )}
      </Card>

      <Card type="inner" title={<Space><DatabaseOutlined /><span>新闻数据源设置</span></Space>} className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)] mb-4">
        <Form.Item name="sources" label="选择数据源" rules={[{ required: true, message: '请至少选择一个数据源' }, { validator: async (_, value) => { if (!value || value.length === 0) return Promise.reject(new Error('请至少选择一个数据源')) } }]} help="选择需要从哪些数据源抓取新闻（至少选择一个）">
          <Select mode="multiple" placeholder="请选择数据源" className="w-full" optionLabelProp="label">
            {sourceOptions.map(option => (
              <Option key={option.value} value={option.value} label={option.label}><Tag color={option.color}>{option.label}</Tag></Option>
            ))}
          </Select>
        </Form.Item>
      </Card>

      <Divider />
      <Form.Item>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none">
          保存设置
        </Button>
      </Form.Item>
    </Form>
  )
}

export default NewsSyncSettings
