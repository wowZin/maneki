import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Card, Radio, Space, Spin, Empty, Typography } from 'antd'
import { LineChartOutlined, ReloadOutlined } from '@ant-design/icons'
import * as echarts from 'echarts'
import { overviewApi, type AccuracyTrendResponse } from '../../../services/overview'

const { Text } = Typography

const PERIOD_OPTIONS = [
  { label: '近7日', value: '7d' },
  { label: '近30日', value: '30d' },
  { label: '近90日', value: '90d' },
  { label: '本年', value: '1y' },
]

const AccuracyTrendChart: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const [data, setData] = useState<AccuracyTrendResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('7d')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await overviewApi.getAccuracyTrend(period)
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

  const option = useMemo(() => {
    if (!data || !data.data || data.data.length === 0) return null

    const dates = data.data.map((item) => item.date)
    const accuracies = data.data.map((item) => parseFloat((item.accuracy * 100).toFixed(2)))

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const idx = params[0].dataIndex
          const item = data.data[idx]
          return `<div style="font-size:13px">
            <div style="font-weight:600;margin-bottom:4px">${item.date}</div>
            <div>正确率: <b>${(item.accuracy * 100).toFixed(2)}%</b></div>
            <div>预测次数: ${item.total_predictions}</div>
            <div>命中次数: ${item.hit_count}</div>
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
          name: '正确率',
          type: 'line',
          data: accuracies,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#e67e22', width: 3 },
          itemStyle: { color: '#e67e22', borderColor: '#fff', borderWidth: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(230,126,34,0.25)' },
                { offset: 1, color: 'rgba(230,126,34,0.02)' },
              ],
            },
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
  }, [option])

  useEffect(() => {
    const handleResize = () => chartInstance.current?.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [])

  return (
    <Card
      title={
        <Space>
          <LineChartOutlined style={{ color: '#e67e22' }} />
          <span>打板预测正确率趋势</span>
          {data?.overall_accuracy !== undefined && (
            <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>
              整体 {(data.overall_accuracy * 100).toFixed(2)}%
            </Text>
          )}
        </Space>
      }
      extra={
        <Space>
          <Radio.Group
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            size="small"
            optionType="button"
            buttonStyle="solid"
          />
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
      ) : !data || !data.data || data.data.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Empty description="暂无数据" />
        </div>
      ) : (
        <div ref={chartRef} style={{ height: 300 }} />
      )}
    </Card>
  )
}

export default AccuracyTrendChart
