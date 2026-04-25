/**
 * Agent Marketplace API 服务
 */
import { api } from './api'

// ============================================
// 类型定义
// ============================================

export interface MarketplaceAgentItem {
  id: number
  name: string
  description: string
  avatar: string
  type: string
  category: string
  price: number
  price_type: string
  is_featured: boolean
  is_official: boolean
  use_count: number
  rating: number
  rating_count: number
  accuracy: number | null
  author_name: string
  created_at: string
}

export interface MarketplaceListResponse {
  items: MarketplaceAgentItem[]
  total: number
  page: number
  size: number
}

export interface AgentAuthor {
  id: string
  name: string
  avatar_url: string
}

export interface AgentDetailResponse {
  id: number
  name: string
  description: string
  avatar: string
  type: string
  category: string
  prompt: string
  model: string
  price: number
  price_type: string
  is_featured: boolean
  is_official: boolean
  is_active: boolean
  use_count: number
  rating: number
  rating_count: number
  accuracy: number | null
  accuracy_period: string
  author: AgentAuthor
  is_subscribed: boolean
  can_subscribe_free: boolean
  created_at: string
  updated_at: string
}

export interface SubscribeResponse {
  subscription_id: number
  agent_id: number
  status: string
  price: number
  start_date: string
  message: string
}

export interface MySubscriptionItem {
  subscription_id: number
  agent_id: number
  agent_name: string
  agent_avatar: string
  status: string
  price: number
  start_date: string
  end_date: string | null
}

export interface MySubscriptionsResponse {
  items: MySubscriptionItem[]
  total: number
  page: number
  size: number
}

export interface CreateAgentRequest {
  name: string
  description?: string
  type: string
  category?: string
  model?: string
  prompt?: string
  price?: number
  price_type?: string
}

export interface CreateAgentResponse {
  id: number
  name: string
  description: string
  type: string
  category: string
  model: string
  price: number
  price_type: string
  is_active: boolean
  is_official: boolean
  is_featured: boolean
  use_count: number
  rating: number
  rating_count: number
  owner_id: string
  created_at: string
}

// ============================================
// API 方法
// ============================================

export const marketplaceApi = {
  // 获取 Agent 市场列表
  getMarketplaceAgents: async (
    params: {
      sort_by?: string
      sort_order?: string
      type?: string
      category?: string
      page?: number
      page_size?: number
    } = {}
  ): Promise<MarketplaceListResponse> => {
    const response = await api.get('/marketplace/agents', { params })
    return response.data
  },

  // 获取 Agent 详情
  getAgentDetail: async (id: number): Promise<AgentDetailResponse> => {
    const response = await api.get(`/marketplace/agents/${id}`)
    return response.data
  },

  // 订阅 Agent
  subscribeAgent: async (id: number): Promise<SubscribeResponse> => {
    const response = await api.post(`/marketplace/agents/${id}/subscribe`)
    return response.data
  },

  // 获取我的订阅列表
  getMySubscriptions: async (
    params: {
      status?: string
      page?: number
      page_size?: number
    } = {}
  ): Promise<MySubscriptionsResponse> => {
    const response = await api.get('/marketplace/my-subscriptions', { params })
    return response.data
  },

  // 创建 Agent（SVIP）
  createAgent: async (data: CreateAgentRequest): Promise<CreateAgentResponse> => {
    const response = await api.post('/marketplace/agents', data)
    return response.data
  },
}
