import React from 'react'
import { List, Spin, Empty, Typography } from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'
import type { SignalItem } from '../../services/signal'
import SignalCard from './SignalCard'

const { Text } = Typography

interface SignalListProps {
  signals: SignalItem[]
  loading: boolean
  error: string | null
  onFollow: (id: number) => void
  onUnfollow: (id: number) => void
  followLoading?: number | null
}

const SignalList: React.FC<SignalListProps> = ({
  signals,
  loading,
  error,
  onFollow,
  onUnfollow,
  followLoading,
}) => {
  if (loading && signals.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spin tip="加载中..." />
      </div>
    )
  }

  if (error) {
    return (
      <Empty
        description={error}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ padding: 60 }}
      />
    )
  }

  if (!signals || signals.length === 0) {
    return (
      <Empty
        description="暂无实时信号"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ padding: 60 }}
      />
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ThunderboltOutlined style={{ color: '#f59e0b' }} />
        <Text strong style={{ fontSize: 15 }}>实时涨停预测</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          共 {signals.length} 条
        </Text>
      </div>
      <List
        dataSource={signals}
        renderItem={(item) => (
          <SignalCard
            signal={item}
            onFollow={onFollow}
            onUnfollow={onUnfollow}
            loading={followLoading === item.id}
          />
        )}
      />
    </div>
  )
}

export default SignalList
