import React, { useState, useEffect } from 'react'
import { Card, Radio, Space, Spin, Empty, Statistic } from 'antd'
import { RiseOutlined, BarChartOutlined } from '@ant-design/icons'
import { signalApi } from '../../services/signal'

const PERIOD_OPTIONS = [
  { label: '近7日', value: '7d' },
  { label: '近30日', value: '30d' },
  { label: '近90日', value: '90d' },
]

const MyStats: React.FC = () => {
  const [data, setData] = useState<{
    total_followed: number
    total_hit: number
    overall_hit_rate: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('7d')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await signalApi.getMyStats(period)
      setData(res)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [period])

  return (
    <Card
      title={
        <Space>
          <BarChartOutlined style={{ color: '#e67e22' }} />
          <span>我的统计</span>
        </Space>
      }
      extra={
        <Radio.Group
          options={PERIOD_OPTIONS}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          size="small"
          optionType="button"
          buttonStyle="solid"
        />
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
      ) : !data ? (
        <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space size="large" style={{ width: '100%', justifyContent: 'space-around' }}>
          <Statistic
            title="关注数"
            value={data.total_followed}
            valueStyle={{ color: '#e67e22', fontWeight: 600 }}
          />
          <Statistic
            title="命中数"
            value={data.total_hit}
            valueStyle={{ color: '#10b981', fontWeight: 600 }}
            prefix={<RiseOutlined />}
          />
          <Statistic
            title="命中率"
            value={(data.overall_hit_rate * 100).toFixed(1)}
            suffix="%"
            valueStyle={{
              color: data.overall_hit_rate >= 0.6 ? '#10b981' : data.overall_hit_rate >= 0.4 ? '#f59e0b' : '#ef4444',
              fontWeight: 600,
            }}
          />
        </Space>
      )}
    </Card>
  )
}

export default MyStats
