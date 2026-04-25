/**
 * Agent 市场列表页
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Row, Col, Typography, Button, Spin, Empty, Pagination } from 'antd'
import { PlusOutlined, ShopOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import AgentCard from './components/AgentCard'
import AgentFilters from './components/AgentFilters'
import SortSelector from './components/SortSelector'
import { marketplaceApi } from '../../services/marketplace'
import { useAuthStore } from '../../stores/auth'
import type { MarketplaceAgentItem } from '../../services/marketplace'

const { Title, Text } = Typography

const Marketplace: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [agents, setAgents] = useState<MarketplaceAgentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [sortBy, setSortBy] = useState('use_count')
  const [sortOrder, setSortOrder] = useState('desc')
  const [filterType, setFilterType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  const isSVIP = (user?.vip_level || 0) >= 2

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await marketplaceApi.getMarketplaceAgents({
        sort_by: sortBy,
        sort_order: sortOrder,
        type: filterType,
        category: filterCategory,
        page,
        page_size: pageSize,
      })
      setAgents(res.items)
      setTotal(res.total)
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    } finally {
      setLoading(false)
    }
  }, [sortBy, sortOrder, filterType, filterCategory, page, pageSize])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            <ShopOutlined style={{ marginRight: 8 }} />
            Agent 市场
          </Title>
          <Text type="secondary">发现和订阅优质的预测 Agent</Text>
        </div>
        {isSVIP && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/marketplace/agents/create')}
          >
            创建 Agent
          </Button>
        )}
      </div>

      {/* 筛选和排序 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <AgentFilters
          type={filterType}
          category={filterCategory}
          onTypeChange={(v) => { setFilterType(v); setPage(1) }}
          onCategoryChange={(v) => { setFilterCategory(v); setPage(1) }}
        />
        <SortSelector
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortByChange={(v) => { setSortBy(v); setPage(1) }}
          onSortOrderChange={(v) => { setSortOrder(v); setPage(1) }}
        />
      </div>

      {/* Agent 列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 64 }}>
          <Spin size="large" />
        </div>
      ) : agents.length === 0 ? (
        <Empty description="暂无 Agent" style={{ padding: 64 }} />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {agents.map((agent, index) => (
              <Col xs={24} md={12} lg={8} key={agent.id}>
                <AgentCard agent={agent} rank={index + 1 + (page - 1) * pageSize} />
              </Col>
            ))}
          </Row>
          {total > pageSize && (
            <div style={{ marginTop: 32, textAlign: 'center' }}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                onChange={(p) => setPage(p)}
                showSizeChanger={false}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Marketplace
