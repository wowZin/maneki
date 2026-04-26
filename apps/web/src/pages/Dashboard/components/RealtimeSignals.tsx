import React, { useState, useEffect, useRef } from 'react'
import { Card, List, Space, Tag, Spin, Empty, Typography, Badge } from 'antd'
import { ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons'
import { overviewApi, type RealtimeSignalItem } from '../../../services/overview'

const { Text } = Typography

const POLLING_INTERVAL = 15000 // 15秒轮询

const getSignalTypeColor = (type: string) => {
  switch (type) {
    case 'buy': return 'success'
    case 'sell': return 'error'
    case 'watch': return 'processing'
    case 'alert': return 'warning'
    default: return 'default'
  }
}

const getSignalTypeLabel = (type: string) => {
  switch (type) {
    case 'buy': return '买入'
    case 'sell': return '卖出'
    case 'watch': return '关注'
    case 'alert': return '预警'
    default: return type
  }
}

const RealtimeSignals: React.FC = () => {
  const [data, setData] = useState<RealtimeSignalItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latestId, setLatestId] = useState<number | undefined>(undefined)
  const [hasNew, setHasNew] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = async (isPolling = false) => {
    if (!isPolling) setLoading(true)
    setError(null)
    try {
      const res = await overviewApi.getRealtimeSignals(10, isPolling ? latestId : undefined)
      if (isPolling && latestId && res.items.length > 0) {
        // 标记新信号
        const newItems = res.items.map((item) => ({ ...item, is_new: true }))
        setData((prev) => {
          const combined = [...newItems, ...prev]
          return combined.slice(0, 50)
        })
        setHasNew(true)
        setTimeout(() => setHasNew(false), 3000)
      } else {
        setData(res.items)
      }
      if (res.latest_id) {
        setLatestId(res.latest_id)
      }
    } catch (e: any) {
      if (!isPolling) {
        setError(e?.response?.data?.error?.message || '加载失败')
      }
    } finally {
      if (!isPolling) setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(() => fetchData(true), POLLING_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#f59e0b' }} />
          <span>实时信号</span>
          {hasNew && (
            <Badge count="新" style={{ backgroundColor: '#ef4444', fontSize: 10 }} />
          )}
        </Space>
      }
      extra={
        <ReloadOutlined onClick={() => fetchData()} style={{ cursor: 'pointer', color: '#6b7280' }} />
      }
      className="glass-card"
      style={{ borderRadius: 16, height: '100%' }}
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Spin tip="加载中..." />
        </div>
      ) : error ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Empty description={error} />
        </div>
      ) : !data || data.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Empty description="暂无实时信号" />
        </div>
      ) : (
        <List
          dataSource={data}
          renderItem={(item) => (
            <List.Item
              style={{
                padding: '12px 0',
                borderBottom: '1px solid #f3f4f6',
                backgroundColor: item.is_new ? 'rgba(230,126,34,0.06)' : 'transparent',
                transition: 'background-color 0.5s ease',
                borderRadius: 8,
                paddingLeft: 8,
                paddingRight: 8,
              }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Space>
                    <Tag color={getSignalTypeColor(item.signal_type)}>{getSignalTypeLabel(item.signal_type)}</Tag>
                    <Text strong>{item.stock_name || item.stock_code}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.stock_code}</Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(item.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </Text>
                </div>
                <Text style={{ fontSize: 13, color: '#4b5563' }}>{item.reason}</Text>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    置信度: {(item.confidence * 100).toFixed(0)}%
                    {item.trigger_price && ` | 触发价: ${item.trigger_price.toFixed(2)}`}
                  </Text>
                </div>
              </div>
            </List.Item>
          )}
          style={{ maxHeight: 420, overflow: 'auto' }}
        />
      )}
    </Card>
  )
}

export default RealtimeSignals
