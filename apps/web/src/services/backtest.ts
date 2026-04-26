/**
 * Backtest API 服务
 */
import { api } from './api'

// ============================================
// 类型定义
// ============================================

export interface BacktestParams {
  start_date: string
  end_date: string
}

export interface BacktestJob {
  id: number
  agent_id: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  params: BacktestParams
  created_at: string
  started_at?: string
  completed_at?: string
  error_msg?: string
}

export interface BacktestDetailItem {
  stock_code: string
  stock_name: string
  decision: string
  score: number
  reasoning?: string
  actual_hit: boolean
}

export interface BacktestDayResult {
  date: string
  total_signals: number
  hit_count: number
  miss_count: number
  hit_rate: number
  details: BacktestDetailItem[]
}

export interface BacktestResult {
  total_days: number
  total_signals: number
  total_hit: number
  total_miss: number
  overall_hit_rate: number
  days: BacktestDayResult[]
}

export interface BacktestResponse {
  id: number
  agent_id: number
  agent_name?: string
  status: string
  progress: number
  params: BacktestParams
  created_at: string
  started_at?: string
  completed_at?: string
  error_msg?: string
  result?: BacktestResult
}

export interface BacktestProgressResponse {
  id: number
  status: string
  progress: number
  message: string
}

export interface BacktestListResponse {
  items: BacktestJob[]
  total: number
}

export interface CreateBacktestRequest {
  agent_id: number
  start_date: string
  end_date: string
}

// ============================================
// API 方法
// ============================================

export const backtestApi = {
  // 创建回测任务
  createBacktest: async (data: CreateBacktestRequest): Promise<BacktestJob> => {
    const response = await api.post('/backtests', data)
    return response.data
  },

  // 获取回测列表
  getBacktests: async (params: { limit?: number; offset?: number } = {}): Promise<BacktestListResponse> => {
    const response = await api.get('/backtests', { params })
    return response.data
  },

  // 获取回测详情
  getBacktest: async (id: number): Promise<BacktestResponse> => {
    const response = await api.get(`/backtests/${id}`)
    return response.data
  },

  // 获取回测进度（轻量轮询）
  getBacktestProgress: async (id: number): Promise<BacktestProgressResponse> => {
    const response = await api.get(`/backtests/${id}/progress`)
    return response.data
  },
}
