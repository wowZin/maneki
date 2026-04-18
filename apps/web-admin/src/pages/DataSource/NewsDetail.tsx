/**
 * 新闻详情页
 * 展示单条新闻的完整内容
 */
import React, { useEffect, useState } from 'react'
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Divider,
  Skeleton,
  message,
  Descriptions,
  Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined,
  LinkOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  EyeOutlined,
  ShareAltOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { datasourceApi, NewsItem } from '../../services/datasource'

const { Title, Paragraph, Text } = Typography

const NewsDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [news, setNews] = useState<NewsItem | null>(null)

  // 获取新闻详情
  const fetchNewsDetail = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await datasourceApi.getNewsById(id)
      setNews(data)
    } catch (error) {
      message.error('获取新闻详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNewsDetail()
  }, [id])

  // 返回列表页
  const handleBack = () => {
    navigate('/datasource/news')
  }

  // 打开原文链接
  const handleOpenSource = (url?: string) => {
    if (url) {
      window.open(url, '_blank')
    }
  }

  // 复制分享链接
  const handleShare = () => {
    const shareUrl = `${window.location.origin}/news/${id}`
    navigator.clipboard.writeText(shareUrl).then(() => {
      message.success('链接已复制到剪贴板')
    }).catch(() => {
      message.error('复制失败')
    })
  }

  // 来源映射
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

  const getSourceInfo = (source: string) => {
    return sourceMap[source] || { label: source || '未知', color: 'default' }
  }

  // 格式化日期
  const formatDate = (datetime?: string) => {
    if (!datetime) return '-'
    return dayjs(datetime).format('YYYY年MM月DD日 HH:mm:ss')
  }

  if (loading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 10 }} />
      </Card>
    )
  }

  if (!news) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <FileTextOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
          <Title level={4} style={{ marginTop: 24, color: '#999' }}>
            新闻不存在或已被删除
          </Title>
          <Button type="primary" onClick={handleBack} style={{ marginTop: 16 }}>
            返回列表
          </Button>
        </div>
      </Card>
    )
  }

  const sourceInfo = getSourceInfo(news.source)

  return (
    <div>
      {/* 顶部操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回列表
          </Button>
          <Divider type="vertical" />
          {news.url && (
            <Button
              type="primary"
              icon={<LinkOutlined />}
              onClick={() => handleOpenSource(news.url)}
            >
              查看原文
            </Button>
          )}
          <Tooltip title="复制分享链接">
            <Button icon={<ShareAltOutlined />} onClick={handleShare}>
              分享
            </Button>
          </Tooltip>
        </Space>
      </Card>

      {/* 新闻内容 */}
      <Card>
        {/* 标题 */}
        <Title level={3} style={{ marginBottom: 24 }}>
          {news.title}
        </Title>

        {/* 元信息 */}
        <Descriptions
          size="small"
          column={{ xs: 1, sm: 2, md: 3 }}
          style={{ marginBottom: 24 }}
        >
          <Descriptions.Item
            label={<Space><GlobalOutlined />来源</Space>}
          >
            <Tag color={sourceInfo.color}>{sourceInfo.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item
            label={<Space><ClockCircleOutlined />发布时间</Space>}
          >
            {formatDate(news.datetime)}
          </Descriptions.Item>
          <Descriptions.Item
            label={<Space><EyeOutlined />新闻ID</Space>}
          >
            <Text copyable style={{ fontSize: 12 }}>{news.id}</Text>
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        {/* 正文内容 */}
        <div style={{ padding: '16px 0' }}>
          <Paragraph
            style={{
              fontSize: 16,
              lineHeight: 2,
              color: '#262626',
              whiteSpace: 'pre-wrap',
            }}
          >
            {news.content}
          </Paragraph>
        </div>

        {/* 原文链接 */}
        {news.url && (
          <>
            <Divider />
            <div style={{ padding: '16px 0' }}>
              <Text type="secondary">原文链接：</Text>
              <br />
              <a
                href={news.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ wordBreak: 'break-all' }}
              >
                {news.url}
              </a>
            </div>
          </>
        )}
      </Card>

      {/* 底部操作栏 */}
      <Card style={{ marginTop: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回列表
          </Button>
          {news.url && (
            <Button
              icon={<LinkOutlined />}
              onClick={() => handleOpenSource(news.url)}
            >
              查看原文
            </Button>
          )}
        </Space>
      </Card>
    </div>
  )
}

export default NewsDetail
