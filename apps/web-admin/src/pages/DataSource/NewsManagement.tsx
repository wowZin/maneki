/**
 * 新闻资讯管理页面
 */
import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Input,
  Button,
  Space,
  Tag,
  Popconfirm,
  message,
  Select,
  DatePicker,
  Row,
  Col,
  Tooltip,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { datasourceApi } from '../../services/datasource'

const { RangePicker } = DatePicker

interface NewsItem {
  id: string
  title: string
  content: string
  source: string
  datetime: string
  url?: string
}

const NewsManagement: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<NewsItem[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  
  // 查询参数
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    source: undefined as string | undefined,
    dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null,
  })

  // 数据来源选项
  const sourceOptions = [
    { label: '全部来源', value: '' },
    { label: '富途牛牛', value: 'global_futu' },
    { label: '同花顺', value: 'global_ths' },
    { label: '财联社', value: 'global_cls' },
    { label: '新浪财经', value: 'global_sina' },
    { label: '东方财富', value: 'eastmoney' },
    { label: '第一财经', value: 'yicai' },
  ]

  // 获取新闻列表
  const fetchNews = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const params: any = {
        page,
        pageSize,
      }
      
      if (searchParams.keyword) {
        params.keyword = searchParams.keyword
      }
      if (searchParams.source) {
        params.source = searchParams.source
      }
      if (searchParams.dateRange) {
        params.startDate = searchParams.dateRange[0].format('YYYYMMDD')
        params.endDate = searchParams.dateRange[1].format('YYYYMMDD')
      }
      
      const result = await datasourceApi.getNews(params)
      setData(result.data || [])
      setPagination({
        current: result.page || page,
        pageSize: result.pageSize || pageSize,
        total: result.total || 0,
      })
    } catch (error) {
      message.error('获取新闻列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNews()
  }, [])

  // 删除单条新闻
  const handleDelete = async (id: string) => {
    try {
      await datasourceApi.deleteNews(id)
      message.success('删除成功')
      fetchNews(pagination.current, pagination.pageSize)
    } catch (error) {
      message.error('删除失败')
    }
  }

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的新闻')
      return
    }
    try {
      await datasourceApi.batchDeleteNews(selectedRowKeys as string[])
      message.success(`成功删除 ${selectedRowKeys.length} 条新闻`)
      setSelectedRowKeys([])
      fetchNews(pagination.current, pagination.pageSize)
    } catch (error) {
      message.error('批量删除失败')
    }
  }

  // 表格列定义
  const columns = [
    {
      title: '索引',
      dataIndex: 'index',
      key: 'index',
      width: 80,
      render: (_: any, __: any, index: number) => {
        return (pagination.current - 1) * pagination.pageSize + index + 1
      },
    },
    {
      title: '新闻标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: NewsItem) => (
        <Tooltip title={text}>
          <span style={{ fontWeight: 500 }}>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '新闻详情',
      dataIndex: 'content',
      key: 'content',
      width: 300,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span style={{ color: '#666' }}>{text || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '信息来源',
      dataIndex: 'source',
      key: 'source',
      width: 120,
      render: (source: string) => {
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
        const config = sourceMap[source] || { label: source || '未知', color: 'default' }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: '发布时间',
      dataIndex: 'datetime',
      key: 'datetime',
      width: 180,
      render: (datetime: string) => datetime || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_: any, record: NewsItem) => (
        <Space size="small">
          {record.url && (
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => window.open(record.url, '_blank')}
            >
              查看
            </Button>
          )}
          <Popconfirm
            title="确认删除"
            description="确定要删除这条新闻吗？此操作不可恢复。"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 表格行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  }

  // 分页配置
  const handleTableChange = (newPagination: any) => {
    fetchNews(newPagination.current, newPagination.pageSize)
  }

  return (
    <div>
      <Card
        title={
          <Space>
            <DatabaseOutlined />
            <span>新闻资讯管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchNews()}>
              刷新
            </Button>
          </Space>
        }
      >
        {/* 查询条件 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="搜索新闻标题/内容"
              value={searchParams.keyword}
              onChange={(e) =>
                setSearchParams({ ...searchParams, keyword: e.target.value })
              }
              prefix={<SearchOutlined />}
              allowClear
              onPressEnter={() => fetchNews(1, pagination.pageSize)}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="选择信息来源"
              value={searchParams.source}
              onChange={(value) =>
                setSearchParams({ ...searchParams, source: value || undefined })
              }
              options={sourceOptions}
              style={{ width: '100%' }}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={8}>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              value={searchParams.dateRange}
              onChange={(dates) =>
                setSearchParams({
                  ...searchParams,
                  dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs],
                })
              }
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Space>
              <Button type="primary" onClick={() => fetchNews(1, pagination.pageSize)}>
                查询
              </Button>
              <Button
                onClick={() => {
                  setSearchParams({
                    keyword: '',
                    source: undefined,
                    dateRange: null,
                  })
                  fetchNews(1, pagination.pageSize)
                }}
              >
                重置
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 批量操作 */}
        {selectedRowKeys.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Popconfirm
              title="确认批量删除"
              description={`确定要删除选中的 ${selectedRowKeys.length} 条新闻吗？`}
              onConfirm={handleBatchDelete}
              okText="确认"
              cancelText="取消"
            >
              <Button type="primary" danger icon={<DeleteOutlined />}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          </div>
        )}

        {/* 数据表格 */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={handleTableChange}
          rowSelection={rowSelection}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  )
}

export default NewsManagement
