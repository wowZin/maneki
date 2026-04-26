/**
 * Agent 详情页
 */
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Tag, Rate, Typography, Space, Spin, Empty, message, Row, Col, Descriptions } from 'antd'
import { ArrowLeftOutlined, RocketOutlined, CrownOutlined, StarOutlined, CheckCircleOutlined, ThunderboltOutlined, HistoryOutlined } from '@ant-design/icons'
import { marketplaceApi } from '../../services/marketplace'
import { useAuthStore } from '../../stores/auth'
import type { AgentDetailResponse } from '../../services/marketplace'

const { Title, Text, Paragraph } = Typography

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

const AgentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuthStore()
  const [agent, setAgent] = useState<AgentDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  const fetchAgent = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await marketplaceApi.getAgentDetail(Number(id))
      setAgent(res)
    } catch (error) {
      console.error('Failed to fetch agent:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgent()
  }, [id])

  const handleSubscribe = async () => {
    if (!agent) return
    setSubscribing(true)
    try {
      await marketplaceApi.subscribeAgent(agent.id)
      message.success('订阅成功')
      fetchAgent()
    } catch (error: any) {
      const errMsg = error?.response?.data?.error || '订阅失败'
      if (errMsg.includes('vip required')) {
        message.error('该 Agent 需要 VIP 会员才能免费订阅')
      } else if (errMsg.includes('already subscribed')) {
        message.warning('您已订阅该 Agent')
      } else {
        message.error(errMsg)
      }
    } finally {
      setSubscribing(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 120 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!agent) {
    return (
      <Empty description="Agent 不存在" style={{ padding: 120 }} />
    )
  }

  const isFree = agent.is_official || agent.is_featured || agent.price === 0
  const showSubscribeButton = isAuthenticated && !agent.is_subscribed
  const subscribeText = isFree ? '免费订阅' : (agent.can_subscribe_free ? 'VIP 免费订阅' : `¥${agent.price}`)

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/marketplace')} style={{ marginBottom: 16 }}>
        返回市场
      </Button>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card className="glass-card">
            <Space align="start" size={20}>
              <img
                src={agent.avatar || '/default-agent-avatar.png'}
                alt={agent.name}
                style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover' }}
              />
              <div>
                <Space size={8} style={{ marginBottom: 8 }}>
                  <Title level={4} style={{ margin: 0 }}>{agent.name}</Title>
                  {agent.is_official && <Tag color="gold" icon={<CrownOutlined />}>官方</Tag>}
                  {agent.is_featured && <Tag color="orange" icon={<StarOutlined />}>精选</Tag>}
                </Space>
                <Space size={8} wrap>
                  <Tag color={typeColors[agent.type] || 'default'}>{typeLabels[agent.type] || agent.type}</Tag>
                  {agent.category && <Tag>{agent.category}</Tag>}
                </Space>
                <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  {agent.description || '暂无描述'}
                </Paragraph>
              </div>
            </Space>

            <Descriptions bordered size="small" style={{ marginTop: 24 }} column={2}>
              <Descriptions.Item label={<><RocketOutlined /> 预测准确率</>}>
                <Text strong style={{ color: '#e67e22' }}>
                  {agent.accuracy !== null ? `${agent.accuracy}%` : '暂无数据'}
                </Text>
                {agent.accuracy_period && <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>({agent.accuracy_period})</Text>}
              </Descriptions.Item>
              <Descriptions.Item label={<><ThunderboltOutlined /> 模型</>}>
                {agent.model || '默认模型'}
              </Descriptions.Item>
              <Descriptions.Item label="评分">
                <Rate disabled value={agent.rating} style={{ fontSize: 14 }} />
                <Text type="secondary" style={{ marginLeft: 8 }}>({agent.rating_count} 人评价)</Text>
              </Descriptions.Item>
              <Descriptions.Item label="使用次数">
                {agent.use_count} 次
              </Descriptions.Item>
              <Descriptions.Item label="作者">
                <Space>
                  <img src={agent.author?.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                  <Text>{agent.author?.name || '匿名'}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="价格">
                {isFree ? <Text type="success">免费</Text> : <Text>¥{agent.price} / {agent.price_type === 'monthly' ? '月' : agent.price_type === 'yearly' ? '年' : '永久'}</Text>}
              </Descriptions.Item>
            </Descriptions>

            {agent.prompt && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>提示词</Title>
                <Card size="small" style={{ background: '#fff8f0', borderRadius: 8 }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13 }}>{agent.prompt}</pre>
                </Card>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="glass-card" style={{ position: 'sticky', top: 24 }}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {agent.is_subscribed ? (
                <>
                  <Button type="primary" block disabled icon={<CheckCircleOutlined />}>
                    已订阅
                  </Button>
                  {isAuthenticated && (user?.vip_level || 0) >= 1 && (
                    <Button
                      block
                      icon={<HistoryOutlined />}
                      onClick={() => navigate(`/replay?agent_id=${agent.id}`)}
                      style={{ marginTop: 8 }}
                    >
                      回测
                    </Button>
                  )}
                </>
              ) : showSubscribeButton ? (
                <Button type="primary" block loading={subscribing} onClick={handleSubscribe}>
                  {subscribeText}
                </Button>
              ) : !isAuthenticated ? (
                <Button type="primary" block onClick={() => navigate('/login')}>
                  登录后订阅
                </Button>
              ) : null}

              {!isFree && !agent.can_subscribe_free && isAuthenticated && !agent.is_subscribed && (
                <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>
                  升级 VIP 即可免费订阅所有 Agent
                </Text>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default AgentDetail
