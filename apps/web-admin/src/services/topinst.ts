/**
 * 龙虎榜机构交易名单 API 服务
 */
import api from './api'

export interface TopInstItem {
  id: string
  trade_date: string
  ts_code: string
  exalter: string
  buy: number
  buy_rate: number
  sell: number
  sell_rate: number
  net_buy: number
  side: string
  reason: string
  source: string
}

export interface TopInstQueryParams {
  page?: number
  pageSize?: number
  ts_code?: string
  exalter?: string
  startDate?: string
  endDate?: string
  min_buy?: number
  max_buy?: number
}

export interface TopInstResponse {
  data: TopInstItem[]
  page: number
  pageSize: number
  total: number
}

export const topInstApi = {
  /**
   * 获取龙虎榜机构交易名单列表
   */
  getTopInstList: async (params: TopInstQueryParams): Promise<TopInstResponse> => {
    const { data } = await api.get('/v1/admin/datasource/top-inst', { params })
    return data
  },

  /**
   * 删除单条龙虎榜机构交易名单数据
   */
  deleteTopInst: async (id: string) => {
    const { data } = await api.delete(`/v1/admin/datasource/top-inst/${id}`)
    return data
  },

  /**
   * 批量删除龙虎榜机构交易名单数据
   */
  batchDeleteTopInst: async (ids: string[]) => {
    const { data } = await api.post('/v1/admin/datasource/top-inst/batch-delete', { ids })
    return data
  },

  /**
   * 同步龙虎榜机构交易名单数据（手动触发）
   */
  syncTopInst: async (tradeDate?: string) => {
    const params = tradeDate ? { trade_date: tradeDate } : {}
    const { data } = await api.post('/v1/admin/datasource/top-inst/sync', null, { params })
    return data
  },

  /**
   * 获取龙虎榜机构交易名单统计
   */
  getStats: async () => {
    const { data } = await api.get('/v1/admin/datasource/top-inst/stats')
    return data
  },

  /**
   * 获取龙虎榜机构交易名单同步设置
   */
  getSyncSettings: async () => {
    const { data } = await api.get('/v1/admin/settings/top-inst-sync')
    return data
  },

  /**
   * 保存龙虎榜机构交易名单同步设置
   */
  saveSyncSettings: async (settings: { enabled: boolean; fixed_times: string[] }) => {
    const { data } = await api.post('/v1/admin/settings/top-inst-sync', settings)
    return data
  },
}
