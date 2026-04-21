/**
 * 龙虎榜数据管理页面
 */
import React, { useState, useEffect } from 'react'
import { Card, Table, Input, Button, Space, Tag, Popconfirm, message, DatePicker, Row, Col, Tooltip, Badge, Form, Modal, TimePicker, Divider, Switch } from 'antd'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, ReloadOutlined, DeleteOutlined, TrophyOutlined, ArrowUpOutlined, ArrowDownOutlined, DollarOutlined, SettingOutlined, PlusOutlined, MinusCircleOutlined, EyeOutlined , InfoCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { topListApi } from '../../services/toplist'
import type { ColumnsType } from 'antd/es/table'

const { RangePicker } = DatePicker

interface TopListItem {
  id: string
  trade_date: string
  ts_code: string
  name: string
  close: number
  pct_change: number
  turnover: number
  amount: number
  net_buy_amount: number
  net_sell_amount: number
  reason: string
  source: string
}

interface TopListStats {
  total: number
  today_count: number
  today_amount: number
}

const TopListManagement: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TopListItem[]>([])
  const [stats, setStats] = useState<TopListStats>({ total: 0, today_count: 0, today_amount: 0 })
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [settingsModalVisible, setSettingsModalVisible] = useState(false)
  const [settingsForm] = Form.useForm()
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [searchParams, setSearchParams] = useState({
    ts_code: '',
    name: '',
    dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null,
    min_amount: undefined as number | undefined,
    max_amount: undefined as number | undefined,
  })

  const fetchStats = async () => {
    try {
      const result = await topListApi.getStats()
      if (result.code === 0) setStats(result.data)
    } catch { /* ignore */ }
  }

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const params: any = { page, pageSize }
      if (searchParams.ts_code) params.ts_code = searchParams.ts_code
      if (searchParams.name) params.name = searchParams.name
      if (searchParams.dateRange) {
        params.startDate = searchParams.dateRange[0].format('YYYYMMDD')
        params.endDate = searchParams.dateRange[1].format('YYYYMMDD')
      }
      if (searchParams.min_amount) params.min_amount = searchParams.min_amount
      if (searchParams.max_amount) params.max_amount = searchParams.max_amount
      const result = await topListApi.getTopList(params)
      setData(result.data || [])
      setPagination({ current: result.page || page, pageSize: result.pageSize || pageSize, total: result.total || 0 })
    } catch {
      message.error('获取龙虎榜数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchStats()
  }, [])

  const handleSync = async () => {
    setLoading(true)
    try {
      const result = await topListApi.syncTopList()
      if (result.code === 0) {
        message.success('同步成功，正在刷新数据...')
        await fetchData(pagination.current, pagination.pageSize)
        await fetchStats()
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
      await topListApi.deleteTopList(id)
      message.success('删除成功')
      fetchData(pagination.current, pagination.pageSize)
      fetchStats()
    } catch {
      message.error('删除失败')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) { message.warning('请选择要删除的数据'); return }
    try {
      await topListApi.batchDeleteTopList(selectedRowKeys as string[])
      message.success(`成功删除 ${selectedRowKeys.length} 条数据`)
      setSelectedRowKeys([])
      fetchData(pagination.current, pagination.pageSize)
      fetchStats()
    } catch {
      message.error('批量删除失败')
    }
  }

  const handleOpenSettings = async () => {
    setSettingsModalVisible(true)
    setSettingsLoading(true)
    try {
      const result = await topListApi.getSyncSettings()
      if (result.data) {
        const fixedTimes = (result.data.fixed_times || ['15:30']).map((t: string) => dayjs(t, 'HH:mm'))
        settingsForm.setFieldsValue({ enabled: result.data.enabled !== false, fixed_times: fixedTimes })
      }
    } catch {
      settingsForm.setFieldsValue({ enabled: true, fixed_times: [dayjs('15:30', 'HH:mm')] })
    } finally {
      setSettingsLoading(false)
    }
  }

  const handleSaveSettings = async (values: any) => {
    try {
      const fixedTimes = values.fixed_times.filter((t: any) => t).map((t: any) => t.format('HH:mm'))
      await topListApi.saveSyncSettings({ enabled: values.enabled, fixed_times: fixedTimes })
      message.success('设置保存成功')
      setSettingsModalVisible(false)
    } catch {
      message.error('保存设置失败')
    }
  }

  const formatAmount = (amount: number) => {
    if (amount >= 100000000) return (amount / 100000000).toFixed(2) + '亿'
    if (amount >= 10000) return (amount / 10000).toFixed(2) + '万'
    return amount.toFixed(2)
  }

  const columns: ColumnsType<TopListItem> = [
    { title: '交易日期', dataIndex: 'trade_date', key: 'trade_date', width: 120 },
    { title: '股票代码', dataIndex: 'ts_code', key: 'ts_code', width: 120 },
    { title: '股票名称', dataIndex: 'name', key: 'name', width: 100, render: (text: string) => <strong>{text}</strong> },
    { title: '收盘价', dataIndex: 'close', key: 'close', width: 100, align: 'right' as const, render: (val: number) => val?.toFixed(2) || '-' },
    {
      title: '涨跌幅', dataIndex: 'pct_change', key: 'pct_change', width: 100, align: 'right' as const,
      render: (val: number) => {
        if (val === undefined || val === null) return '-'
        const color = val > 0 ? 'text-[#cf1322]' : val < 0 ? 'text-[#3f8600]' : 'text-[var(--color-text-tertiary)]'
        const icon = val > 0 ? <ArrowUpOutlined /> : val < 0 ? <ArrowDownOutlined /> : null
        return <span className={color}>{icon} {val > 0 ? '+' : ''}{val.toFixed(2)}%</span>
      },
    },
    { title: '换手率', dataIndex: 'turnover', key: 'turnover', width: 100, align: 'right' as const, render: (val: number) => val ? `${val.toFixed(2)}%` : '-' },
    {
      title: '龙虎榜成交额', dataIndex: 'amount', key: 'amount', width: 140, align: 'right' as const,
      render: (val: number) => (
        <Tooltip title={`${val?.toFixed(2) || 0} 元`}><span>{val ? formatAmount(val) : '-'}</span></Tooltip>
      ),
    },
    {
      title: '净买入额', dataIndex: 'net_buy_amount', key: 'net_buy_amount', width: 130, align: 'right' as const,
      render: (val: number) => {
        if (!val) return '-'
        return <Tooltip title={`${val.toFixed(2)} 元`}><Tag color="red">{formatAmount(val)}</Tag></Tooltip>
      },
    },
    {
      title: '净卖出额', dataIndex: 'net_sell_amount', key: 'net_sell_amount', width: 130, align: 'right' as const,
      render: (val: number) => {
        if (!val) return '-'
        return <Tooltip title={`${val.toFixed(2)} 元`}><Tag color="green">{formatAmount(val)}</Tag></Tooltip>
      },
    },
    {
      title: '上榜原因', dataIndex: 'reason', key: 'reason', ellipsis: true,
      render: (text: string) => <Tooltip title={text}><span>{text || '-'}</span></Tooltip>,
    },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right',
      render: (_: any, record: TopListItem) => (
        <Space size="small">
          <Tooltip title="查看详情"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/datasource/top-list/${record.id}`)} /></Tooltip>
          <Popconfirm title="确认删除" description="确定要删除这条龙虎榜数据吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const rowSelection = { selectedRowKeys, onChange: (keys: React.Key[]) => setSelectedRowKeys(keys) }
  const handleTableChange = (newPagination: any) => fetchData(newPagination.current, newPagination.pageSize)

  const statCards = [
    { label: '龙虎榜数据总数', value: stats.total, icon: <TrophyOutlined />, bar: 'from-[#7c3aed] to-[#a78bfa]', iconBg: 'bg-[#f5f3ff]', iconText: 'text-[#5b21b6]' },
    { label: '今日上榜', value: stats.today_count, icon: <Badge status="processing" />, bar: 'from-[#10b981] to-[#34d399]', iconBg: 'bg-[#ecfdf5]', iconText: 'text-[#059669]' },
    { label: '今日成交额', value: formatAmount(stats.today_amount), icon: <DollarOutlined />, bar: 'from-[#3b82f6] to-[#60a5fa]', iconBg: 'bg-[#eff6ff]', iconText: 'text-[#1d4ed8]' },
  ]

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
          <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
            <TrophyOutlined />
          </span>
          龙虎榜数据管理
        </h1>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            管理每日龙虎榜上榜股票数据</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {statCards.map((s, i) => (
          <div key={i} className="relative overflow-hidden bg-white border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
            <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${s.bar}`} />
            <div className={`w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center text-base mb-2 ${s.iconBg} ${s.iconText}`}>{s.icon}</div>
            <div className="text-xl font-bold text-[var(--color-text-primary)] leading-tight">{s.value}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]"
        extra={
          <Space>
            <Button icon={<SettingOutlined />} onClick={handleOpenSettings}>同步设置</Button>
            <Button icon={<ReloadOutlined />} onClick={handleSync} loading={loading}>同步数据</Button>
          </Space>
        }
      >
        <Row gutter={[12, 12]} className="mb-5">
          <Col xs={24} sm={12} md={6}>
            <Input placeholder="搜索股票代码" value={searchParams.ts_code} onChange={e => setSearchParams({ ...searchParams, ts_code: e.target.value })} prefix={<SearchOutlined />} allowClear onPressEnter={() => fetchData(1, pagination.pageSize)} />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Input placeholder="搜索股票名称" value={searchParams.name} onChange={e => setSearchParams({ ...searchParams, name: e.target.value })} prefix={<SearchOutlined />} allowClear onPressEnter={() => fetchData(1, pagination.pageSize)} />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <RangePicker placeholder={['开始日期', '结束日期']} value={searchParams.dateRange} onChange={dates => setSearchParams({ ...searchParams, dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] })} className="w-full" />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Space>
              <Button type="primary" onClick={() => fetchData(1, pagination.pageSize)} className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none">查询</Button>
              <Button onClick={() => { setSearchParams({ ts_code: '', name: '', dateRange: null, min_amount: undefined, max_amount: undefined }); fetchData(1, pagination.pageSize) }}>重置</Button>
            </Space>
          </Col>
        </Row>

        {selectedRowKeys.length > 0 && (
          <div className="mb-4">
            <Popconfirm title="确认批量删除" description={`确定要删除选中的 ${selectedRowKeys.length} 条数据吗？`} onConfirm={handleBatchDelete}>
              <Button type="primary" danger icon={<DeleteOutlined />}>批量删除 ({selectedRowKeys.length})</Button>
            </Popconfirm>
          </div>
        )}

        <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
          pagination={{ ...pagination, showSizeChanger: true, showQuickJumper: true, showTotal: total => `共 ${total} 条` }}
          onChange={handleTableChange} rowSelection={rowSelection} scroll={{ x: 1400 }}
        />
      </Card>

      <Modal title="涨停榜同步设置" open={settingsModalVisible} onOk={settingsForm.submit} onCancel={() => setSettingsModalVisible(false)} confirmLoading={settingsLoading} width={600}>
        <Form form={settingsForm} layout="vertical" onFinish={handleSaveSettings}>
          <Form.Item name="enabled" label="启用自动同步" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="固定获取时间" required tooltip="设置每天自动获取涨停榜数据的时间点，通常为收盘后">
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
                  <Form.Item><Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>添加时间</Button></Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
          <div className="text-[var(--color-text-tertiary)] text-xs">
            <Divider />
            <p>提示：</p>
            <ul className="list-disc pl-4">
              <li>系统将在设定的时间点自动从 akshare 获取当日涨停榜数据</li>
              <li>建议设置为收盘后的时间，如 15:30</li>
              <li>可以设置多个时间点作为备份</li>
            </ul>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default TopListManagement