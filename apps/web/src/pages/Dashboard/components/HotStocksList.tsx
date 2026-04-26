import React, { useState, useEffect } from 'react'
import { Card, List, Space, Spin, Empty, Typography, Badge } from 'antd'
import { FireOutlined, ReloadOutlined } from '@ant-design/icons'
import { overviewApi, type HotStockItem } from '../../../services/overview'

const { Text } = Typography

const HotStocksList: React.FC = () => {
  const [data, setData] = useState<HotStockItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await overviewApi.getHotStocks(20)
      setData(res.items)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <Card
      title={
        <Space>
          <FireOutlined style={{ color: '#ef4444' }} />
          <span>热门股票</span>
        </Space>
      }
      extra={
        <ReloadOutlined onClick={fetchData} style={{ cursor: 'pointer', color: '#6b7280' }} />
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
          <Empty description="暂无热门股票数据" />
        </div>
      ) : (
        <List
          dataSource={data}
          renderItem={(item, index) => (
            <List.Item
              style={{ padding: '10px 0', borderBottom: index < data.length - 1 ? '1px solid #f3f4f6' : 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12 }}>
                <Badge
                  count={item.rank}
                  style={{
                    backgroundColor: item.rank === 1 ? '#ef4444' : item.rank === 2 ? '#f39c12' : item.rank === 3 ? '#e67e22' : '#a09080',
                    minWidth: 22,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {item.stock_name || item.stock_code}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.stock_code}
                  </Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontWeight: 600,
                    color: item.change_pct >= 0 ? '#ef4444' : '#10b981',
                  }}>
                    {item.change_pct >= 0 ? '+' : ''}{item.change_pct.toFixed(2)}%
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    热度 {item.heat_score.toFixed(1)}
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

export default HotStocksList
