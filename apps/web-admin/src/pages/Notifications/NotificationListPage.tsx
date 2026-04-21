/**
 * 消息列表页面（后台任务推送的任务消息）
 * 不在菜单中展示，通过通知中心"查看全部通知"进入
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Button, Tag, Space, Badge, List, Empty, Typography, Spin, Modal,
} from 'antd'
import {
  ArrowLeftOutlined, BellOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useNotificationStore } from '../../stores/notification'

dayjs.extend(relativeTime)

const { Text } = Typography

const NotificationListPage: React.FC = () => {
  const navigate = useNavigate()
  const [page] = useState(1)
  const [pageSize] = useState(20)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<any>(null)

  const {
    notifications,
    unreadCount,
    loading,
    fetchList,
    markRead,
    markAllRead,
  } = useNotificationStore()

  useEffect(() => {
    fetchList({ page, pageSize })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchList])

  const handleClick = async (item: any) => {
    if (!item.is_read) {
      await markRead(item.id)
    }
    setDetailItem(item)
    setDetailOpen(true)
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'task_failed':
        return <ExclamationCircleOutlined className="text-[#ff4d4f] text-lg" />
      case 'task_success':
        return <CheckCircleOutlined className="text-[#52c41a] text-lg" />
      case 'system':
        return <FileTextOutlined className="text-[#3b82f6] text-lg" />
      default:
        return <BellOutlined className="text-[#94a3b8] text-lg" />
    }
  }

  const getTag = (type: string) => {
    switch (type) {
      case 'task_failed':
        return <Tag color="error">任务失败</Tag>
      case 'task_success':
        return <Tag color="success">任务成功</Tag>
      case 'system':
        return <Tag color="blue">系统</Tag>
      default:
        return <Tag>其他</Tag>
    }
  }

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
            <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
              <BellOutlined />
            </span>
            消息中心
          </h1>
          {unreadCount > 0 && (
            <Badge count={unreadCount} className="mt-1" />
          )}
        </div>
        <Space>
          {unreadCount > 0 && (
            <Button type="primary" onClick={markAllRead}>
              全部已读
            </Button>
          )}
        </Space>
      </div>

      {/* List */}
      <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
        {loading && notifications.length === 0 ? (
          <div className="text-center py-20">
            <Spin size="large" />
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            description="暂无消息"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            className="py-20"
          />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(item: any) => (
              <List.Item
                className={`cursor-pointer rounded-lg px-4 py-4 mb-2 transition-colors hover:bg-[var(--color-bg-hover)] ${
                  item.is_read ? 'bg-transparent' : 'bg-[#f0f7ff]'
                }`}
                onClick={() => handleClick(item)}
              >
                <List.Item.Meta
                  avatar={
                    <div className="w-10 h-10 rounded-full bg-[var(--color-bg-subtle)] flex items-center justify-center">
                      {getIcon(item.type)}
                    </div>
                  }
                  title={
                    <div className="flex items-center gap-2">
                      <Text
                        strong={!item.is_read}
                        className="text-[var(--color-text-primary)]"
                      >
                        {item.title}
                      </Text>
                      {!item.is_read && <Badge status="processing" />}
                      {getTag(item.type)}
                    </div>
                  }
                  description={
                    <div className="mt-1">
                      <div className="text-sm text-[var(--color-text-secondary)] max-w-[720px] leading-relaxed">
                        {item.content ? (
                          <Text ellipsis={{ tooltip: item.content }} className="text-sm">
                            {item.content}
                          </Text>
                        ) : (
                          <Text type="secondary" className="text-sm italic">
                            暂无内容
                          </Text>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                        {' · '}
                        {dayjs(item.created_at).fromNow()}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            {detailItem && getIcon(detailItem.type)}
            <span>{detailItem?.title || '消息详情'}</span>
          </div>
        }
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          <Button type="primary" onClick={() => setDetailOpen(false)}>
            关闭
          </Button>
        }
        width={600}
      >
        {detailItem && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              {getTag(detailItem.type)}
              <Text type="secondary">
                {dayjs(detailItem.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </div>
            {detailItem.content ? (
              <pre className="p-4 bg-[var(--color-bg-subtle)] rounded-lg overflow-auto max-h-[400px] text-sm whitespace-pre-wrap">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(detailItem.content), null, 2)
                  } catch {
                    return detailItem.content
                  }
                })()}
              </pre>
            ) : (
              <div className="p-4 bg-[var(--color-bg-subtle)] rounded-lg text-sm text-[var(--color-text-secondary)] italic">
                该消息暂无内容
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default NotificationListPage
