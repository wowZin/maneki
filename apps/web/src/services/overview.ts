/**
 * 首页概览 API 服务
 */
import { api } from './api'

// ============================================
// 类型定义
// ============================================

export interface AccuracyTrendItem {
  date: string
  accuracy: number
  total_predictions: number
  hit_count: number
}

export interface AccuracyTrendResponse {
  period: string
  data: AccuracyTrendItem[]
  overall_accuracy: number
  updated_at: string
}

export interface UserTrackingTrendItem {
  date: string
  tracked_count: number
  hit_count: number
  hit_rate: number
}

export interface UserTrackingSummary {
  total_tracked: number
  total_hit: number
  overall_hit_rate: number
}

export interface UserTrackingTrendResponse {
  period: string
  data: UserTrackingTrendItem[]
  summary: UserTrackingSummary
  updated_at: string
}

export interface UserTrackingDetailItem {
  stock_code: string
  stock_name: string
  tracked_at: string
  hit_status: boolean | null
  change_pct: number
  close_price: number
}

export interface PaginationMeta {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface UserTrackingDetailResponse {
  date: string
  items: UserTrackingDetailItem[]
  pagination: PaginationMeta
}

export interface AgentPerformanceItem {
  agent_id: number
  agent_name: string
  agent_type: string
  total_predictions: number
  hit_count: number
  hit_rate: number
  trend: string
  rank: number
}

export interface AgentPerformanceResponse {
  period: string
  agents: AgentPerformanceItem[]
  updated_at: string
}

export interface HotStockItem {
  rank: number
  stock_code: string
  stock_name: string
  heat_score: number
  price: number
  change_pct: number
  volume: number
}

export interface HotStocksResponse {
  items: HotStockItem[]
  calculated_at: string
}

export interface RealtimeSignalItem {
  id: number
  signal_type: string
  stock_code: string
  stock_name: string
  confidence: number
  trigger_price: number | null
  reason: string
  created_at: string
  is_new?: boolean
}

export interface RealtimeSignalsResponse {
  items: RealtimeSignalItem[]
  has_more: boolean
  latest_id: number
}

// ============================================
// API 方法
// ============================================

export const overviewApi = {
  // 打板预测正确率趋势
  getAccuracyTrend: async (period: string = '7d'): Promise<AccuracyTrendResponse> => {
    const response = await api.get('/overview/accuracy-trend', { params: { period } })
    return response.data
  },

  // 用户选中涨停股票趋势
  getUserTrackingTrend: async (period: string = '7d'): Promise<UserTrackingTrendResponse> => {
    const response = await api.get('/overview/user-tracking-trend', { params: { period } })
    return response.data
  },

  // 用户选中涨停股票明细
  getUserTrackingDetail: async (date: string, page: number = 1, pageSize: number = 20): Promise<UserTrackingDetailResponse> => {
    const response = await api.get('/overview/user-tracking-detail', {
      params: { date, page, page_size: pageSize },
    })
    return response.data
  },

  // Agent 命中率
  getAgentPerformance: async (period: string = '7d', sortBy: string = 'hit_rate', limit: number = 20): Promise<AgentPerformanceResponse> => {
    const response = await api.get('/overview/agent-performance', {
      params: { period, sort_by: sortBy, limit },
    })
    return response.data
  },

  // 热门股票
  getHotStocks: async (limit: number = 20): Promise<HotStocksResponse> => {
    const response = await api.get('/overview/hot-stocks', { params: { limit } })
    return response.data
  },

  // 实时信号
  getRealtimeSignals: async (limit: number = 10, afterId?: number): Promise<RealtimeSignalsResponse> => {
    const params: Record<string, number | string> = { limit }
    if (afterId) {
      params.after_id = afterId
    }
    const response = await api.get('/overview/realtime-signals', { params })
    return response.data
  },
}
