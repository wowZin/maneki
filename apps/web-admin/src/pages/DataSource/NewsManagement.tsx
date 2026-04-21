import React, { useState, useEffect } from 'react'
import {
  Card, Table, Input, Button, Space, Tag, Popconfirm, message, Select, DatePicker, Row, Col, Tooltip, Form, Modal, TimePicker, Radio, InputNumber,
} from 'antd'
import {
  SearchOutlined, ReloadOutlined, DeleteOutlined, DatabaseOutlined, EyeOutlined, FileTextOutlined, SettingOutlined, PlusOutlined, MinusCircleOutlined,

  InfoCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { datasourceApi } from '../../services/datasource'
import type { ColumnsType } from 'antd/es/table'

const { RangePicker } = DatePicker

interface NewsItem {
  id: string
  title: string
  content: string
  source: string
  datetime: string
  url?: string
}

const sourceMap: Record<string, { label: string; color: string }> = {
  global_futu: { label: '富途牛牛', color: 'purple' },
  global_ths: { label: '同花顺', color: 'orange' },
  global_cls: { label: '财联社', color: 'cyan' },
  global_sina: { label: '新浪财经', color: 'blue' },
  sina: { label: '新浪财经', color: 'blue' },
  eastmoney: { label: '东方财富', color: 'red' },
  '10jqka': { label: '同花顺', color: 'orange' },
  yicai: { label: '第一财经', color: 'green' },
}

const sourceOptions = [
  { label: '全部来源', value: '' },
  { label: '富途牛牛', value: 'global_futu' },
  { label: '同花顺', value: 'global_ths' },
  { label: '财联社', value: 'global_cls' },
  { label: '新浪财经', value: 'global_sina' },
  { label: '东方财富', value: 'eastmoney' },
  { label: '第一财经', value: 'yicai' },
]

const NewsManagement: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<NewsItem[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [settingsModalVisible, setSettingsModalVisible] = useState(false)
  const [settingsForm] = Form.useForm()
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [timeMode, setTimeMode] = useState<'fixed' | 'interval'>('fixed')
  const [searchParams, setSearchParams] = useState({ keyword: '', source: undefined as string | undefined, dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null })

  const fetchNews = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const params: any = { page, pageSize }
      if (searchParams.keyword) params.keyword = searchParams.keyword
      if (searchParams.source) params.source = searchParams.source
      if (searchParams.dateRange) {
        params.startDate = searchParams.dateRange[0].format('YYYYMMDD')
        params.endDate = searchParams.dateRange[1].format('YYYYMMDD')
      }
      const result = await datasourceApi.getNews(params)
      setData(result.data || [])
      setPagination({ current: result.page || page, pageSize: result.pageSize || pageSize, total: result.total || 0 })
    } catch {
      message.error('获取新闻列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNews() }, [])

  const handleSyncNews = async () => {
    setLoading(true)
    try {
      const result = await datasourceApi.syncNews()
      if (result.code === 0) {
        message.success('同步成功，正在刷新列表...')
        await fetchNews(pagination.current, pagination.pageSize)
      } else {
        message.error(result.message || '同步失败')
      }
    } catch {
      message.error('同步请求失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await datasourceApi.deleteNews(id)
      message.success('删除成功')
      fetchNews(pagination.current, pagination.pageSize)
    } catch {
      message.error('删除失败')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) { message.warning('请选择要删除的新闻'); return }
    try {
      await datasourceApi.batchDeleteNews(selectedRowKeys as string[])
      message.success(`成功删除 ${selectedRowKeys.length} 条新闻`)
      setSelectedRowKeys([])
      fetchNews(pagination.current, pagination.pageSize)
    } catch {
      message.error('批量删除失败')
    }
  }

  const handleOpenSettings = async () => {
    setSettingsModalVisible(true)
    setSettingsLoading(true)
    try {
      const result = await datasourceApi.getNewsSyncSettings()
      if (result.data) {
        const mode = result.data.time_mode || 'fixed'
        setTimeMode(mode)
        const fixedTimes = (result.data.fixed_times || ['08:00', '12:00', '15:30']).map((t: string) => dayjs(t, 'HH:mm'))
        settingsForm.setFieldsValue({
          time_mode: mode,
          interval_hours: result.data.interval_hours || 1,
          fixed_times: fixedTimes,
          sources: result.data.sources || ['global_futu', 'global_ths', 'global_cls', 'global_sina'],
        })
      }
    } catch {
      setTimeMode('fixed')
      settingsForm.setFieldsValue({
        time_mode: 'fixed',
        interval_hours: 1,
        fixed_times: [dayjs('08:00', 'HH:mm'), dayjs('12:00', 'HH:mm'), dayjs('15:30', 'HH:mm')],
        sources: ['global_futu', 'global_ths', 'global_cls', 'global_sina'],
      })
    } finally {
      setSettingsLoading(false)
    }
  }

  const handleSaveSettings = async (values: any) => {
    try {
      const payload: any = { time_mode: values.time_mode, sources: values.sources }
      if (values.time_mode === 'fixed') {
        payload.fixed_times = values.fixed_times.filter((t: any) => t).map((t: any) => t.format('HH:mm'))
      } else {
        payload.interval_hours = values.interval_hours
      }
      await datasourceApi.saveNewsSyncSettings(payload)
      message.success('设置保存成功')
      setSettingsModalVisible(false)
    } catch {
      message.error('保存设置失败')
    }
  }

  const columns: ColumnsType<NewsItem> = [
    { title: '索引', key: 'index', width: 70, render: (_: any, __: any, index: number) => (pagination.current - 1) * pagination.pageSize + index + 1 },
    { title: '新闻标题', dataIndex: 'title', key: 'title', ellipsis: true, render: (text: string) => <Tooltip title={text}><span className="font-medium">{text}</span></Tooltip> },
    { title: '新闻详情', dataIndex: 'content', key: 'content', width: 300, ellipsis: true, render: (text: string) => <Tooltip title={text}><span className="text-[var(--color-text-secondary)]">{text || '-'}</span></Tooltip> },
    {
      title: '信息来源', dataIndex: 'source', key: 'source', width: 120,
      render: (source: string) => {
        const config = sourceMap[source] || { label: source || '未知', color: 'default' }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    { title: '发布时间', dataIndex: 'datetime', key: 'datetime', width: 170, render: (datetime: string) => datetime || '-' },
    {
      title: '操作', key: 'action', width: 180, fixed: 'right',
      render: (_: any, record: NewsItem) => (
        <Space size="small">
          <Button type="text" size="small" icon={<FileTextOutlined />} onClick={() => navigate(`/datasource/news/${record.id}`)}>详情</Button>
          {record.url && (
            <Tooltip title="查看原文"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => window.open(record.url, '_blank')} /></Tooltip>
          )}
          <Popconfirm title="确认删除" description="确定要删除这条新闻吗？此操作不可恢复。" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除"><Button type="text" danger size="small" icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
          <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
            <DatabaseOutlined />
          </span>
          新闻资讯管理
        </h1>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            管理各数据源同步的新闻资讯数据</p>
      </div>

      <Card
        className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]"
        extra={
          <Space>
            <Button icon={<SettingOutlined />} onClick={handleOpenSettings}>同步设置</Button>
            <Button icon={<ReloadOutlined />} onClick={handleSyncNews} loading={loading}>强制刷新</Button>
          </Space>
        }
      >
        <Row gutter={[12, 12]} className="mb-5">
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input placeholder="搜索新闻标题/内容" value={searchParams.keyword} onChange={e => setSearchParams({ ...searchParams, keyword: e.target.value })} prefix={<SearchOutlined />} allowClear onPressEnter={() => fetchNews(1, pagination.pageSize)} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select placeholder="选择信息来源" value={searchParams.source} onChange={value => setSearchParams({ ...searchParams, source: value || undefined })} options={sourceOptions} style={{ width: '100%' }} allowClear />
          </Col>
          <Col xs={24} sm={12} md={8} lg={8}>
            <RangePicker placeholder={['开始日期', '结束日期']} value={searchParams.dateRange} onChange={dates => setSearchParams({ ...searchParams, dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] })} style={{ width: '100%' }} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Space>
              <Button type="primary" onClick={() => fetchNews(1, pagination.pageSize)} className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none">查询</Button>
              <Button onClick={() => { setSearchParams({ keyword: '', source: undefined, dateRange: null }); fetchNews(1, pagination.pageSize) }}>重置</Button>
            </Space>
          </Col>
        </Row>

        {selectedRowKeys.length > 0 && (
          <div className="mb-4">
            <Popconfirm title="确认批量删除" description={`确定要删除选中的 ${selectedRowKeys.length} 条新闻吗？`} onConfirm={handleBatchDelete}>
              <Button type="primary" danger icon={<DeleteOutlined />}>批量删除 ({selectedRowKeys.length})</Button>
            </Popconfirm>
          </div>
        )}

        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{ ...pagination, showSizeChanger: true, showQuickJumper: true, showTotal: total => `共 ${total} 条` }}
          onChange={newPagination => fetchNews(newPagination.current, newPagination.pageSize)}
          rowSelection={{ selectedRowKeys, onChange: (keys: React.Key[]) => setSelectedRowKeys(keys) }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title="新闻同步设置"
        open={settingsModalVisible}
        onOk={settingsForm.submit}
        onCancel={() => setSettingsModalVisible(false)}
        confirmLoading={settingsLoading}
        width={640}
      >
        <Form form={settingsForm} layout="vertical" onFinish={handleSaveSettings}>
          <Form.Item name="time_mode" label="同步模式" rules={[{ required: true, message: '请选择同步模式' }]}>
            <Radio.Group onChange={e => setTimeMode(e.target.value)}>
              <Radio value="fixed">固定时间</Radio>
              <Radio value="interval">按间隔</Radio>
            </Radio.Group>
          </Form.Item>

          {timeMode === 'interval' && (
            <Form.Item name="interval_hours" label="间隔小时数" rules={[{ required: true, message: '请输入间隔小时数' }]}>
              <InputNumber min={1} max={24} style={{ width: 200 }} />
            </Form.Item>
          )}

          {timeMode === 'fixed' && (
            <Form.Item label="固定获取时间" required tooltip="设置每天自动获取新闻数据的时间点">
              <Form.List name="fixed_times">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(field => (
                      <Space key={field.key} align="baseline">
                        <Form.Item {...field} validateTrigger={['onChange', 'onBlur']} rules={[{ required: true, whitespace: true, message: '请选择时间' }]} noStyle>
                          <TimePicker format="HH:mm" placeholder="选择时间" />
                        </Form.Item>
                        {fields.length > 1 && <MinusCircleOutlined onClick={() => remove(field.name)} />}
                      </Space>
                    ))}
                    <Form.Item>
                      <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>添加时间</Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Form.Item>
          )}

          <Form.Item name="sources" label="启用的数据源" rules={[{ required: true, message: '请至少选择一个数据源' }]}>
            <Select mode="multiple" placeholder="选择数据源" options={[
              { label: '富途牛牛', value: 'global_futu' },
              { label: '同花顺', value: 'global_ths' },
              { label: '财联社', value: 'global_cls' },
              { label: '新浪财经', value: 'global_sina' },
            ]} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default NewsManagement