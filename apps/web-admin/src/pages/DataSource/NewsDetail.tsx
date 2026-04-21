/**
 * 新闻详情页
 * 展示单条新闻的完整内容
 */
import React, { useEffect, useState } from 'react'
import { Card, Button, Space, Tag, Typography, Divider, Skeleton, message, Descriptions, Tooltip } from 'antd'
import { ArrowLeftOutlined, LinkOutlined, ClockCircleOutlined, GlobalOutlined, EyeOutlined, ShareAltOutlined, FileTextOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { datasourceApi, NewsItem } from '../../services/datasource'

const { Title, Paragraph, Text } = Typography

const NewsDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [news, setNews] = useState<NewsItem | null>(null)

  const fetchNewsDetail = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await datasourceApi.getNewsById(id)
      setNews(data)
    } catch {
      message.error('获取新闻详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNewsDetail()
  }, [id])

  const handleBack = () => navigate('/datasource/news')
  const handleOpenSource = (url?: string) => { if (url) window.open(url, '_blank') }
  const handleShare = () => {
    const shareUrl = `${window.location.origin}/news/${id}`
    navigator.clipboard.writeText(shareUrl).then(() => message.success('链接已复制到剪贴板')).catch(() => message.error('复制失败'))
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

  const getSourceInfo = (source: string) => sourceMap[source] || { label: source || '未知', color: 'default' }
  const formatDate = (datetime?: string) => datetime ? dayjs(datetime).format('YYYY年MM月DD日 HH:mm:ss') : '-'

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto p-4 md:p-6">
        <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
          <Skeleton active paragraph={{ rows: 10 }} />
        </Card>
      </div>
    )
  }

  if (!news) {
    return (
      <div className="max-w-[1440px] mx-auto p-4 md:p-6">
        <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
          <div className="text-center py-16 text-[var(--color-text-secondary)]">
            <FileTextOutlined className="text-6xl mb-4" />
            <Title level={4} className="text-[var(--color-text-secondary)] mt-4">新闻不存在或已被删除</Title>
            <Button type="primary" onClick={handleBack} className="mt-4 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none">返回列表</Button>
          </div>
        </Card>
      </div>
    )
  }

  const sourceInfo = getSourceInfo(news.source)

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)] mb-4">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>返回列表</Button>
          <Divider type="vertical" />
          {news.url && (
            <Button type="primary" icon={<LinkOutlined />} onClick={() => handleOpenSource(news.url)} className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none">
              查看原文
            </Button>
          )}
          <Tooltip title="复制分享链接">
            <Button icon={<ShareAltOutlined />} onClick={handleShare}>分享</Button>
          </Tooltip>
        </Space>
      </Card>

      <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)] mb-4">
        <Title level={3} className="mb-4">{news.title}</Title>
        <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} className="mb-4">
          <Descriptions.Item label={<Space><GlobalOutlined />来源</Space>}>
            <Tag color={sourceInfo.color}>{sourceInfo.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={<Space><ClockCircleOutlined />发布时间</Space>}>{formatDate(news.datetime)}</Descriptions.Item>
          <Descriptions.Item label={<Space><EyeOutlined />新闻ID</Space>}>
            <Text copyable className="text-xs">{news.id}</Text>
          </Descriptions.Item>
        </Descriptions>
        <Divider />
        <div className="py-4">
          <Paragraph className="text-base leading-8 text-[var(--color-text-primary)] whitespace-pre-wrap">
            {news.content}
          </Paragraph>
        </div>
        {news.url && (
          <>
            <Divider />
            <div className="py-4">
              <Text type="secondary">原文链接：</Text>
              <br />
              <a href={news.url} target="_blank" rel="noopener noreferrer" className="break-all">{news.url}</a>
            </div>
          </>
        )}
      </Card>

      <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>返回列表</Button>
          {news.url && <Button icon={<LinkOutlined />} onClick={() => handleOpenSource(news.url)}>查看原文</Button>}
        </Space>
      </Card>
    </div>
  )
}

export default NewsDetail
