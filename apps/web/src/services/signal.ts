/**
 * 信号中心 API 服务
 */
import { api } from './api'

// ============================================
// 类型定义
// ============================================

export interface SignalItem {
  id: number
  stock_code: string
  stock_name: string
  signal_type: string
  confidence: number
  trigger_price: number | null
  reason: string
  created_at: string
  is_followed: boolean
}

export interface SignalsResponse {
  items: SignalItem[]
  has_more: boolean
  latest_id: number
}

export interface FollowResponse {
  success: boolean
  tracking_id: number
  stock_code: string
  stock_name: string
  track_date: string
}

export interface MyFollowItem {
  tracking_id: number
  signal_id: number
  stock_code: string
  stock_name: string
  confidence: number
  reason: string
  created_at: string
  hit_status: boolean | null
}

export interface MyFollowsResponse {
  items: MyFollowItem[]
  total: number
}

export interface MyStatsResponse {
  period: string
  total_followed: number
  total_hit: number
  overall_hit_rate: number
  updated_at: string
}

// ============================================
// API 方法
// ============================================

export const signalApi = {
  // 获取信号列表
  getSignals: async (limit: number = 20, afterId?: number): Promise<SignalsResponse> => {
    const params: Record<string, number | string> = { limit }
    if (afterId) {
      params.after_id = afterId
    }
    const response = await api.get('/signals', { params })
    return response.data
  },

  // 关注信号
  followSignal: async (signalId: number): Promise<FollowResponse> => {
    const response = await api.post(`/signals/${signalId}/follow`)
    return response.data
  },

  // 取消关注
  unfollowSignal: async (signalId: number): Promise<{ success: boolean }> => {
    const response = await api.delete(`/signals/${signalId}/follow`)
    return response.data
  },

  // 获取我的关注
  getMyFollows: async (): Promise<MyFollowsResponse> => {
    const response = await api.get('/signals/my-follows')
    return response.data
  },

  // 获取我的统计
  getMyStats: async (period: string = '7d'): Promise<MyStatsResponse> => {
    const response = await api.get('/signals/my-stats', { params: { period } })
    return response.data
  },
}
