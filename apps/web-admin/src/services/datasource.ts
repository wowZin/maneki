/**
 * 数据源管理 API 服务
 * 用于调用 data-service 服务
 */

import api from './api'

export interface NewsItem {
  id: string
  title: string
  content: string
  source: string
  datetime: string
  url?: string
}

export interface NewsQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  source?: string
  startDate?: string
  endDate?: string
}

export interface NewsListResponse {
  data: NewsItem[]
  page: number
  pageSize: number
  total: number
}

// 涨停榜/龙虎榜数据项
export interface TopListItem {
  id: string
  trade_date: string
  ts_code: string
  name: string
  close: number
  pct_change: number
  turnover: number
  amount: number
  net_buy_amount: number
  net_sell_amount: number
  reason: string
  source: string
}

export interface TopListQueryParams {
  page?: number
  pageSize?: number
  ts_code?: string
  name?: string
  startDate?: string
  endDate?: string
  min_amount?: number
  max_amount?: number
}

export interface TopListResponse {
  data: TopListItem[]
  page: number
  pageSize: number
  total: number
}

export const datasourceApi = {
  /**
   * 获取新闻列表
   */
  getNews: async (params: NewsQueryParams): Promise<NewsListResponse> => {
    const { data } = await api.get('/v1/admin/datasource/news', { params })
    return data
  },

  /**
   * 获取单条新闻详情
   */
  getNewsById: async (id: string): Promise<NewsItem> => {
    const { data } = await api.get(`/v1/admin/datasource/news/${id}`)
    return data.data
  },

  /**
   * 删除新闻
   */
  deleteNews: async (id: string) => {
    const { data } = await api.delete(`/v1/admin/datasource/news/${id}`)
    return data
  },

  /**
   * 批量删除新闻
   */
  batchDeleteNews: async (ids: string[]) => {
    const { data } = await api.post('/v1/admin/datasource/news/batch-delete', { ids })
    return data
  },

  /**
   * 同步新闻数据（手动触发）
   */
  syncNews: async () => {
    const { data } = await api.post('/v1/admin/datasource/news/sync')
    return data
  },

  /**
   * 获取市场情绪数据
   */
  getSentiment: async (date?: string) => {
    const { data } = await api.get('/v1/admin/datasource/sentiment', { params: { date } })
    return data
  },

  /**
   * 获取数据源状态
   */
  getDataSourceStatus: async () => {
    const { data } = await api.get('/v1/admin/datasource/status')
    return data
  },

  /**
   * 获取数据统计
   */
  getStats: async () => {
    const { data } = await api.get('/v1/admin/datasource/stats')
    return data
  },

  /**
   * 获取新闻同步设置
   */
  getNewsSyncSettings: async () => {
    const { data } = await api.get('/v1/admin/settings/news-sync')
    return data
  },

  /**
   * 保存新闻同步设置
   */
  saveNewsSyncSettings: async (settings: {
    time_mode: 'fixed' | 'interval'
    fixed_times?: string[]
    interval_hours?: number
    sources: string[]
  }) => {
    const { data } = await api.post('/v1/admin/settings/news-sync', settings)
    return data
  },

  // ========== 龙虎榜/涨停榜相关接口 ==========

  /**
   * 获取龙虎榜列表
   */
  getTopList: async (params: TopListQueryParams): Promise<TopListResponse> => {
    const { data } = await api.get('/v1/admin/datasource/top-list', { params })
    return data
  },

  /**
   * 删除单条龙虎榜数据
   */
  deleteTopList: async (id: string) => {
    const { data } = await api.delete(`/v1/admin/datasource/top-list/${id}`)
    return data
  },

  /**
   * 批量删除龙虎榜数据
   */
  batchDeleteTopList: async (ids: string[]) => {
    const { data } = await api.post('/v1/admin/datasource/top-list/batch-delete', { ids })
    return data
  },

  /**
   * 同步龙虎榜数据
   */
  syncTopList: async (tradeDate?: string) => {
    const params = tradeDate ? { trade_date: tradeDate } : {}
    const { data } = await api.post('/v1/admin/datasource/top-list/sync', null, { params })
    return data
  },

  /**
   * 获取龙虎榜统计
   */
  getTopListStats: async () => {
    const { data } = await api.get('/v1/admin/datasource/top-list/stats')
    return data
  },

  /**
   * 获取龙虎榜同步设置
   */
  getTopListSyncSettings: async () => {
    const { data } = await api.get('/v1/admin/settings/top-list-sync')
    return data
  },

  /**
   * 保存龙虎榜同步设置
   */
  saveTopListSyncSettings: async (settings: {
    enabled: boolean
    fixed_times: string[]
  }) => {
    const { data } = await api.post('/v1/admin/settings/top-list-sync', settings)
    return data
  },
}
