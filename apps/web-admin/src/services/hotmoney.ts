/**
 * 游资名录 API 服务
 */
import api from './api'

export interface HotMoneyItem {
  id: string
  name: string
  description: string
  organizations: string
  source: string
}

export interface HotMoneyQueryParams {
  page?: number
  pageSize?: number
  name?: string
}

export interface HotMoneyResponse {
  data: HotMoneyItem[]
  page: number
  pageSize: number
  total: number
}

export const hotMoneyApi = {
  /**
   * 获取游资名录列表
   */
  getHotMoneyList: async (params: HotMoneyQueryParams): Promise<HotMoneyResponse> => {
    const { data } = await api.get('/v1/admin/datasource/hot-money', { params })
    return data
  },

  /**
   * 删除单条游资名录数据
   */
  deleteHotMoney: async (id: string) => {
    const { data } = await api.delete(`/v1/admin/datasource/hot-money/${id}`)
    return data
  },

  /**
   * 批量删除游资名录数据
   */
  batchDeleteHotMoney: async (ids: string[]) => {
    const { data } = await api.post('/v1/admin/datasource/hot-money/batch-delete', { ids })
    return data
  },

  /**
   * 同步游资名录数据（手动触发）
   */
  syncHotMoney: async () => {
    const { data } = await api.post('/v1/admin/datasource/hot-money/sync')
    return data
  },

  /**
   * 获取游资名录统计
   */
  getStats: async () => {
    const { data } = await api.get('/v1/admin/datasource/hot-money/stats')
    return data
  },

  /**
   * 获取游资名录同步设置
   */
  getSyncSettings: async () => {
    const { data } = await api.get('/v1/admin/settings/hot-money-sync')
    return data
  },

  /**
   * 保存游资名录同步设置
   */
  saveSyncSettings: async (settings: { enabled: boolean; fixed_times: string[] }) => {
    const { data } = await api.post('/v1/admin/settings/hot-money-sync', settings)
    return data
  },
}
