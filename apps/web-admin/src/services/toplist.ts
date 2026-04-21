/**
 * 龙虎榜数据 API 服务
 */
import api from './api'

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

export const topListApi = {
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
   * 同步龙虎榜数据（手动触发）
   */
  syncTopList: async (tradeDate?: string) => {
    const params = tradeDate ? { trade_date: tradeDate } : {}
    const { data } = await api.post('/v1/admin/datasource/top-list/sync', null, { params })
    return data
  },

  /**
   * 获取龙虎榜统计
   */
  getStats: async () => {
    const { data } = await api.get('/v1/admin/datasource/top-list/stats')
    return data
  },

  /**
   * 获取龙虎榜同步设置
   */
  getSyncSettings: async () => {
    const { data } = await api.get('/v1/admin/settings/top-list-sync')
    return data
  },

  /**
   * 保存龙虎榜同步设置
   */
  saveSyncSettings: async (settings: { enabled: boolean; fixed_times: string[] }) => {
    const { data } = await api.post('/v1/admin/settings/top-list-sync', settings)
    return data
  },
}
