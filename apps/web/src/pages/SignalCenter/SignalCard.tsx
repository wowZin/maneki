import React from 'react'
import { Card, Tag, Button, Space, Typography, Tooltip } from 'antd'
import { EyeOutlined, CheckOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { SignalItem } from '../../services/signal'

const { Text } = Typography

interface SignalCardProps {
  signal: SignalItem
  onFollow: (id: number) => void
  onUnfollow: (id: number) => void
  loading?: boolean
}

const SignalCard: React.FC<SignalCardProps> = ({ signal, onFollow, onUnfollow, loading }) => {
  return (
    <Card
      size="small"
      style={{
        marginBottom: 12,
        borderRadius: 12,
        border: '1px solid #f3f4f6',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      bodyStyle={{ padding: '14px 16px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Tag color="warning" icon={<ThunderboltOutlined />}>
              涨停预测
            </Tag>
            <Text strong style={{ fontSize: 16 }}>
              {signal.stock_name || signal.stock_code}
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {signal.stock_code}
            </Text>
          </div>

          <Text style={{ fontSize: 13, color: '#4b5563', display: 'block', marginBottom: 8 }}>
            {signal.reason}
          </Text>

          <Space size={16}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              置信度: <span style={{ color: '#e67e22', fontWeight: 600 }}>{(signal.confidence * 100).toFixed(0)}%</span>
            </Text>
            {signal.trigger_price && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                触发价: <span style={{ fontWeight: 500 }}>{signal.trigger_price.toFixed(2)}</span>
              </Text>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              预测时间: {new Date(signal.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          </Space>
        </div>

        <div style={{ marginLeft: 16 }}>
          {signal.is_followed ? (
            <Tooltip title="取消关注">
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={loading}
                onClick={() => onUnfollow(signal.id)}
                style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
              >
                已关注
              </Button>
            </Tooltip>
          ) : (
            <Button
              type="primary"
              icon={<EyeOutlined />}
              loading={loading}
              onClick={() => onFollow(signal.id)}
            >
              关注
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

export default SignalCard
