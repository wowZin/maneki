import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Card, Space, Spin, Empty, Typography, Button } from 'antd'
import { RiseOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import * as echarts from 'echarts'
import { overviewApi, type UserTrackingTrendResponse } from '../../../services/overview'

const { Text } = Typography

interface UserTrackingCardProps {
  onViewDetail: (date: string) => void
}

const UserTrackingCard: React.FC<UserTrackingCardProps> = ({ onViewDetail }) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const [data, setData] = useState<UserTrackingTrendResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await overviewApi.getUserTrackingTrend('7d')
      setData(res)
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

  const option = useMemo(() => {
    if (!data || data.data.length === 0) return null

    const dates = data.data.map((item) => item.date)
    const hitRates = data.data.map((item) => parseFloat((item.hit_rate * 100).toFixed(2)))

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const idx = params[0].dataIndex
          const item = data.data[idx]
          return `<div style="font-size:13px">
            <div style="font-weight:600;margin-bottom:4px">${item.date}</div>
            <div>命中率: <b>${(item.hit_rate * 100).toFixed(2)}%</b></div>
            <div>关注总数: ${item.tracked_count}</div>
            <div>命中数: ${item.hit_count}</div>
          </div>`
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisLabel: { color: '#6b7280', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%', color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f3f4f6' } },
      },
      series: [
        {
          name: '命中率',
          type: 'bar',
          data: hitRates,
          barWidth: '50%',
          itemStyle: {
            color: (params: any) => {
              const val = hitRates[params.dataIndex]
              return val >= 60 ? '#10b981' : val >= 40 ? '#f59e0b' : '#ef4444'
            },
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    }
  }, [data])

  useEffect(() => {
    if (!chartRef.current || !option) return
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current)
    }
    chartInstance.current.setOption(option, true)
    chartInstance.current.off('click')
    chartInstance.current.on('click', (params: any) => {
      const date = data?.data[params.dataIndex]?.date
      if (date) onViewDetail(date)
    })
  }, [option, onViewDetail, data])

  useEffect(() => {
    const handleResize = () => chartInstance.current?.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [])

  const latestDate = data?.data[data.data.length - 1]?.date

  return (
    <Card
      title={
        <Space>
          <RiseOutlined style={{ color: '#10b981' }} />
          <span>用户选中涨停股票趋势</span>
          {data?.summary && (
            <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>
              近7日 {data.summary.total_hit}/{data.summary.total_tracked}
            </Text>
          )}
        </Space>
      }
      extra={
        <Space>
          {latestDate && (
            <Button size="small" icon={<EyeOutlined />} onClick={() => onViewDetail(latestDate)}>
              查看明细
            </Button>
          )}
          <ReloadOutlined onClick={fetchData} style={{ cursor: 'pointer', color: '#6b7280' }} />
        </Space>
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
      ) : !data || data.data.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Empty description="暂无追踪数据，开始关注股票吧" />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>近7日关注</Text>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#e67e22' }}>
                {data.summary.total_tracked}
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>命中</Text>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#10b981' }}>
                {data.summary.total_hit}
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>命中率</Text>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#f59e0b' }}>
                {(data.summary.overall_hit_rate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          <div ref={chartRef} style={{ height: 220 }} />
        </>
      )}
    </Card>
  )
}

export default UserTrackingCard
