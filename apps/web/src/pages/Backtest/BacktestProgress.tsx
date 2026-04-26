/**
 * BacktestProgress.tsx
 * 回测进度组件 - 展示实时进度条和状态信息
 */
import React from 'react'
import { Card, Progress, Typography, Space, Button, Alert, Spin } from 'antd'
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined, RedoOutlined } from '@ant-design/icons'
import { BacktestProgressResponse } from '../../services/backtest'

const { Title, Text } = Typography

interface BacktestProgressProps {
  progress: BacktestProgressResponse | null
  loading: boolean
  onRetry?: () => void
}

const BacktestProgress: React.FC<BacktestProgressProps> = ({ progress, loading, onRetry }) => {
  if (loading && !progress) {
    return (
      <Card className="glass-card">
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <Text style={{ display: 'block', marginTop: 16 }}>加载中...</Text>
        </div>
      </Card>
    )
  }

  if (!progress) {
    return null
  }

  const { status, progress: percent, message } = progress

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return '#10b981'
      case 'failed':
        return '#ef4444'
      case 'running':
        return '#e67e22'
      default:
        return '#9ca3af'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#10b981', fontSize: 24 }} />
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ef4444', fontSize: 24 }} />
      case 'running':
        return <LoadingOutlined style={{ color: '#e67e22', fontSize: 24 }} />
      default:
        return <Spin size="small" />
    }
  }

  return (
    <Card className="glass-card">
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>
          回测进度
        </Title>

        <Space align="center" size={12}>
          {getStatusIcon()}
          <Text strong style={{ fontSize: 16, color: getStatusColor() }}>
            {message}
          </Text>
        </Space>

        <Progress
          percent={percent}
          status={status === 'failed' ? 'exception' : status === 'completed' ? 'success' : 'active'}
          strokeColor={getStatusColor()}
          showInfo={true}
          format={(p) => `${p}%`}
        />

        {status === 'failed' && onRetry && (
          <Alert
            message="回测失败"
            description={message}
            type="error"
            showIcon
            action={
              <Button size="small" icon={<RedoOutlined />} onClick={onRetry}>
                重试
              </Button>
            }
          />
        )}
      </Space>
    </Card>
  )
}

export default BacktestProgress
