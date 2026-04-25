/**
 * Agent 卡片组件
 */
import React from 'react'
import { Card, Tag, Rate, Badge, Typography, Space, Tooltip } from 'antd'
import { RocketOutlined, TrophyOutlined, CrownOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { MarketplaceAgentItem } from '../../../services/marketplace'

const { Text } = Typography

interface AgentCardProps {
  agent: MarketplaceAgentItem
  rank?: number
}

const typeLabels: Record<string, string> = {
  technical: '技术面',
  fundamental: '基本面',
  sentiment: '情绪面',
  capital: '资金面',
  decision: '决策',
  custom: '自定义',
}

const typeColors: Record<string, string> = {
  technical: 'blue',
  fundamental: 'green',
  sentiment: 'purple',
  capital: 'orange',
  decision: 'cyan',
  custom: 'default',
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, rank }) => {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/marketplace/agents/${agent.id}`)
  }

  const rankBadge = () => {
    if (rank === 1) return <TrophyOutlined style={{ color: '#f59e0b', fontSize: 18 }} />
    if (rank === 2) return <TrophyOutlined style={{ color: '#94a3b8', fontSize: 18 }} />
    if (rank === 3) return <TrophyOutlined style={{ color: '#b45309', fontSize: 18 }} />
    return <Text type="secondary" style={{ fontSize: 14, fontWeight: 600, width: 18, textAlign: 'center' }}>{rank}</Text>
  }

  return (
    <Card
      hoverable
      onClick={handleClick}
      style={{ borderRadius: 16, cursor: 'pointer', position: 'relative' }}
      bodyStyle={{ padding: 16 }}
    >
      {agent.is_featured && (
        <Badge
          count={<CrownOutlined style={{ color: '#f59e0b' }} />}
          style={{ position: 'absolute', top: 8, right: 8, background: 'transparent', boxShadow: 'none' }}
        />
      )}
      <Space align="start" size={12}>
        {rank !== undefined && (
          <div style={{ paddingTop: 4 }}>{rankBadge()}</div>
        )}
        <img
          src={agent.avatar || '/default-agent-avatar.png'}
          alt={agent.name}
          style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text strong style={{ fontSize: 15 }} ellipsis>{agent.name}</Text>
            {agent.is_official && <Tag color="gold" style={{ margin: 0, fontSize: 11 }}>官方</Tag>}
          </div>
          <Space size={4} wrap style={{ marginBottom: 6 }}>
            <Tag color={typeColors[agent.type] || 'default'} style={{ fontSize: 11 }}>
              {typeLabels[agent.type] || agent.type}
            </Tag>
            {agent.category && (
              <Tag style={{ fontSize: 11 }}>{agent.category}</Tag>
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }} ellipsis={{ tooltip: true }}>
            {agent.description || '暂无描述'}
          </Text>
          <Space size={16} style={{ marginTop: 8 }}>
            <Tooltip title="预测准确率">
              <Space size={2}>
                <RocketOutlined style={{ color: '#3b82f6', fontSize: 12 }} />
                <Text style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>
                  {agent.accuracy !== null ? `${agent.accuracy}%` : 'N/A'}
                </Text>
              </Space>
            </Tooltip>
            <Rate disabled value={agent.rating} style={{ fontSize: 11 }} />
            <Text type="secondary" style={{ fontSize: 11 }}>({agent.rating_count})</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{agent.use_count} 次使用</Text>
          </Space>
        </div>
      </Space>
    </Card>
  )
}

export default AgentCard
