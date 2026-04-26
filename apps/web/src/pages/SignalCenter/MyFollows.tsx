import React, { useState, useEffect } from 'react'
import { Card, List, Tag, Space, Spin, Empty, Typography } from 'antd'
import { HeartOutlined, CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { signalApi, type MyFollowItem } from '../../services/signal'

const { Text } = Typography

const MyFollows: React.FC = () => {
  const [data, setData] = useState<MyFollowItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await signalApi.getMyFollows()
      setData(res.items)
    } catch (e: any) {
      if (e?.response?.status === 401) {
        setError('请先登录')
      } else {
        setError(e?.response?.data?.error?.message || '加载失败')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const getStatusTag = (status: boolean | null) => {
    if (status === null) {
      return <Tag icon={<QuestionCircleOutlined />} color="default">待复盘</Tag>
    }
    if (status) {
      return <Tag icon={<CheckCircleOutlined />} color="success">涨停</Tag>
    }
    return <Tag icon={<CloseCircleOutlined />} color="error">未涨停</Tag>
  }

  return (
    <Card
      title={
        <Space>
          <HeartOutlined style={{ color: '#ef4444' }} />
          <span>今日关注</span>
        </Space>
      }
      className="glass-card"
      style={{ borderRadius: 16, marginBottom: 16 }}
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spin tip="加载中..." />
        </div>
      ) : error ? (
        <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : !data || data.length === 0 ? (
        <Empty description="今日暂无关注记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={data}
          renderItem={(item) => (
            <List.Item
              style={{
                padding: '10px 0',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {item.stock_name || item.stock_code}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.stock_code}
                  </Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ marginBottom: 4 }}>
                    {getStatusTag(item.hit_status)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    置信度 {(item.confidence * 100).toFixed(0)}%
                  </Text>
                </div>
              </div>
            </List.Item>
          )}
          style={{ maxHeight: 320, overflow: 'auto' }}
        />
      )}
    </Card>
  )
}

export default MyFollows