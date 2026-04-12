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

export const datasourceApi = {
  /**
   * 获取新闻列表
   */
  getNews: async (params: NewsQueryParams): Promise<NewsListResponse> => {
    const { data } = await api.get('/datasource/news', { params })
    return data
  },

  /**
   * 获取单条新闻详情
   */
  getNewsById: async (id: string): Promise<NewsItem> => {
    const { data } = await api.get(`/datasource/news/${id}`)
    return data
  },

  /**
   * 删除新闻
   */
  deleteNews: async (id: string) => {
    const { data } = await api.delete(`/datasource/news/${id}`)
    return data
  },

  /**
   * 批量删除新闻
   */
  batchDeleteNews: async (ids: string[]) => {
    const { data } = await api.post('/datasource/news/batch-delete', { ids })
    return data
  },

  /**
   * 同步新闻数据（手动触发）
   */
  syncNews: async () => {
    const { data } = await api.post('/datasource/news/sync')
    return data
  },

  /**
   * 获取市场情绪数据
   */
  getSentiment: async (date?: string) => {
    const { data } = await api.get('/datasource/sentiment', { params: { date } })
    return data
  },

  /**
   * 获取数据源状态
   */
  getDataSourceStatus: async () => {
    const { data } = await api.get('/datasource/status')
    return data
  },

  /**
   * 获取数据统计
   */
  getStats: async () => {
    const { data } = await api.get('/datasource/stats')
    return data
  },

  /**
   * 获取新闻同步设置
   */
  getNewsSyncSettings: async () => {
    const { data } = await api.get('/settings/news-sync')
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
    const { data } = await api.post('/settings/news-sync', settings)
    return data
  },
}
