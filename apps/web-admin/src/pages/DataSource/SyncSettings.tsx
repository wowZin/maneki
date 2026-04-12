/**
 * 数据源同步设置页面
 */
import React, { useState, useEffect } from 'react'
import {
  Card,
  Form,
  Radio,
  Select,
  TimePicker,
  Button,
  Space,
  message,
  InputNumber,
  Tag,
  Row,
  Col,
  Divider,
} from 'antd'
import {
  SaveOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  PlusOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { datasourceApi } from '../../services/datasource'

const { Option } = Select

interface NewsSyncSettings {
  time_mode: 'fixed' | 'interval'
  fixed_times: string[]
  interval_hours: number
  sources: string[]
}

const SyncSettings: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [timeMode, setTimeMode] = useState<'fixed' | 'interval'>('interval')

  // 数据源选项
  const sourceOptions = [
    { value: 'global_futu', label: '富途牛牛', color: 'purple' },
    { value: 'global_ths', label: '同花顺', color: 'orange' },
    { value: 'global_cls', label: '财联社', color: 'cyan' },
    { value: 'global_sina', label: '新浪财经', color: 'blue' },
  ]

  // 获取当前设置
  const fetchSettings = async () => {
    setLoading(true)
    try {
      const result = await datasourceApi.getNewsSyncSettings()
      if (result.code === 0) {
        const data = result.data
        setTimeMode(data.time_mode)

        // 转换时间格式
        const fixedTimes = data.fixed_times?.map((t: string) => dayjs(t, 'HH:mm')) || []

        form.setFieldsValue({
          time_mode: data.time_mode,
          fixed_times: fixedTimes,
          interval_hours: data.interval_hours || 1,
          sources: data.sources || sourceOptions.map((s) => s.value),
        })
      }
    } catch (error) {
      message.error('获取设置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  // 保存设置
  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      // 转换时间格式
      const fixedTimes = values.fixed_times?.map((t: dayjs.Dayjs) => t.format('HH:mm')) || []

      const data: NewsSyncSettings = {
        time_mode: values.time_mode,
        fixed_times: fixedTimes,
        interval_hours: values.interval_hours,
        sources: values.sources,
      }

      const result = await datasourceApi.saveNewsSyncSettings(data)
      if (result.code === 0) {
        message.success('设置已保存')
      } else {
        message.error(result.message || '保存失败')
      }
    } catch (error) {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 渲染数据源标签
  const renderSourceTag = (value: string) => {
    const option = sourceOptions.find((o) => o.value === value)
    return option ? (
      <Tag color={option.color}>{option.label}</Tag>
    ) : (
      <Tag>{value}</Tag>
    )
  }

  return (
    <div>
      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            <span>数据源同步设置</span>
          </Space>
        }
        loading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            time_mode: 'interval',
            interval_hours: 1,
            sources: sourceOptions.map((s) => s.value),
          }}
        >
          {/* 同步时间设置 */}
          <Card
            type="inner"
            title={
              <Space>
                <ClockCircleOutlined />
                <span>同步时间设置</span>
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            <Form.Item
              name="time_mode"
              label="同步模式"
              rules={[{ required: true, message: '请选择同步模式' }]}
            >
              <Radio.Group onChange={(e) => setTimeMode(e.target.value)}>
                <Radio value="fixed">固定时间模式</Radio>
                <Radio value="interval">间隔时间模式</Radio>
              </Radio.Group>
            </Form.Item>

            {timeMode === 'fixed' ? (
              <Form.Item
                label="同步时段"
                required
                help="设置在哪些时间点自动同步新闻数据"
              >
                <Form.List
                  name="fixed_times"
                  rules={[
                    {
                      validator: async (_, value) => {
                        if (!value || value.length === 0) {
                          return Promise.reject(new Error('请至少添加一个同步时间'))
                        }
                      },
                    },
                  ]}
                >
                  {(fields, { add, remove }, { errors }) => (
                    <>
                      {fields.map((field, index) => (
                        <Space key={field.key} align="baseline">
                          <Form.Item
                            {...field}
                            validateTrigger={['onChange', 'onBlur']}
                            rules={[
                              {
                                required: true,
                                message: '请选择时间',
                              },
                              {
                                validator: (_, value) => {
                                  if (!value || !dayjs.isDayjs(value)) {
                                    return Promise.reject(new Error('请选择有效时间'))
                                  }
                                  const hour = value.hour()
                                  const minute = value.minute()
                                  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                                    return Promise.reject(new Error('时间格式无效'))
                                  }
                                  return Promise.resolve()
                                },
                              },
                            ]}
                            noStyle
                          >
                            <TimePicker
                              format="HH:mm"
                              placeholder="选择时间"
                            />
                          </Form.Item>
                          {fields.length > 1 && (
                            <MinusCircleOutlined
                              style={{ color: '#999' }}
                              onClick={() => remove(field.name)}
                            />
                          )}
                        </Space>
                      ))}
                      <Form.Item>
                        <Button
                          type="dashed"
                          onClick={() => add(dayjs('08:00', 'HH:mm'))}
                          icon={<PlusOutlined />}
                        >
                          添加时段
                        </Button>
                        <Form.ErrorList errors={errors} />
                      </Form.Item>
                    </>
                  )}
                </Form.List>
              </Form.Item>
            ) : (
              <Form.Item
                name="interval_hours"
                label="间隔时间"
                rules={[
                  { required: true, message: '请输入间隔时间' },
                  { type: 'number', min: 1, max: 24, message: '间隔时间必须在 1-24 小时之间' },
                ]}
                help="每隔多少小时自动同步一次新闻数据"
              >
                <InputNumber
                  min={1}
                  max={24}
                  addonAfter="小时"
                  style={{ width: 200 }}
                />
              </Form.Item>
            )}
          </Card>

          {/* 数据源设置 */}
          <Card
            type="inner"
            title={
              <Space>
                <DatabaseOutlined />
                <span>新闻数据源设置</span>
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            <Form.Item
              name="sources"
              label="选择数据源"
              rules={[
                { required: true, message: '请至少选择一个数据源' },
                {
                  validator: async (_, value) => {
                    if (!value || value.length === 0) {
                      return Promise.reject(new Error('请至少选择一个数据源'))
                    }
                  },
                },
              ]}
              help="选择需要从哪些数据源抓取新闻（至少选择一个）"
            >
              <Select
                mode="multiple"
                placeholder="请选择数据源"
                style={{ width: '100%' }}
                optionLabelProp="label"
              >
                {sourceOptions.map((option) => (
                  <Option
                    key={option.value}
                    value={option.value}
                    label={option.label}
                  >
                    <Tag color={option.color}>{option.label}</Tag>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item>
              <Space>
                <span>已选择的数据源：</span>
                <Form.Item name="sources" noStyle>
                  <Select
                    mode="multiple"
                    style={{ display: 'none' }}
                  />
                </Form.Item>
                {/* 这里显示标签，实际由上面的 Select 控制 */}
              </Space>
            </Form.Item>
          </Card>

          <Divider />

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
              size="large"
            >
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default SyncSettings
