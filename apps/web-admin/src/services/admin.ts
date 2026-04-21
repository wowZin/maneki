/**
 * 管理后台 API 服务
 */

import api from './api'

export const adminApi = {
  // 概览统计
  getDashboardStats: async () => {
    const { data } = await api.get('/v1/admin/dashboard/stats')
    return data
  },

  // Agent 管理
  getAgentTemplates: async (params: { page?: number; pageSize?: number; search?: string }) => {
    const { data } = await api.get('/v1/admin/agents', { params })
    return data
  },

  createAgent: async (payload: any) => {
    const { data } = await api.post('/v1/admin/agents', payload)
    return data
  },

  updateAgentTemplate: async (agentId: string, updates: any) => {
    const { data } = await api.put(`/v1/admin/agents/${agentId}`, updates)
    return data
  },

  deleteAgent: async (agentId: string) => {
    const { data } = await api.delete(`/v1/admin/agents/${agentId}`)
    return data
  },

  // 返佣管理
  getRebates: async (params: {
    page?: number
    pageSize?: number
    search?: string
    status?: string | null
  }) => {
    const { data } = await api.get('/v1/admin/rebates', { params })
    return data
  },

  getRebateStats: async () => {
    const { data } = await api.get('/v1/admin/rebates/stats')
    return data
  },

  batchSettleRebates: async () => {
    const { data } = await api.post('/v1/admin/rebates/batch-settle')
    return data
  },

  // 系统配置
  getSettings: async () => {
    const { data } = await api.get('/v1/admin/settings')
    return data
  },

  updateSettings: async (settings: any) => {
    const { data } = await api.put('/v1/admin/settings', settings)
    return data
  },

  // 返佣定价规则
  getRebateRules: async (params: { page?: number; pageSize?: number; status?: string; agent_id?: number }) => {
    const { data } = await api.get('/v1/admin/rebate-rules', { params })
    return data
  },

  getRebateRule: async (id: number) => {
    const { data } = await api.get(`/v1/admin/rebate-rules/${id}`)
    return data
  },

  createRebateRule: async (payload: any) => {
    const { data } = await api.post('/v1/admin/rebate-rules', payload)
    return data
  },

  updateRebateRule: async (id: number, payload: any) => {
    const { data } = await api.put(`/v1/admin/rebate-rules/${id}`, payload)
    return data
  },

  toggleRebateRuleStatus: async (id: number, status: string) => {
    const { data } = await api.post(`/v1/admin/rebate-rules/${id}/toggle`, { status })
    return data
  },

  deleteRebateRule: async (id: number) => {
    const { data } = await api.delete(`/v1/admin/rebate-rules/${id}`)
    return data
  },

  // 防套利规则
  getAntiArbitrageRules: async (params: { status?: string; strategy_type?: string }) => {
    const { data } = await api.get('/v1/admin/anti-arbitrage-rules', { params })
    return data
  },

  createAntiArbitrageRule: async (payload: any) => {
    const { data } = await api.post('/v1/admin/anti-arbitrage-rules', payload)
    return data
  },

  updateAntiArbitrageRule: async (id: number, payload: any) => {
    const { data } = await api.put(`/v1/admin/anti-arbitrage-rules/${id}`, payload)
    return data
  },

  toggleAntiArbitrageRuleStatus: async (id: number, status: string) => {
    const { data } = await api.post(`/v1/admin/anti-arbitrage-rules/${id}/toggle`, { status })
    return data
  },

  deleteAntiArbitrageRule: async (id: number) => {
    const { data } = await api.delete(`/v1/admin/anti-arbitrage-rules/${id}`)
    return data
  },

  // 返佣统计
  getRebateDashboardStats: async (params?: { start_date?: string; end_date?: string }) => {
    const { data } = await api.get('/v1/admin/rebate-stats/dashboard', { params })
    return data
  },

  getRebateTrend: async (params?: { group_by?: string; start_date?: string; end_date?: string; agent_id?: number; creator_id?: number }) => {
    const { data } = await api.get('/v1/admin/rebate-stats/trend', { params })
    return data
  },

  getRebateCreatorRanking: async (params?: { page?: number; pageSize?: number; start_date?: string; end_date?: string }) => {
    const { data } = await api.get('/v1/admin/rebate-stats/creators', { params })
    return data
  },

  getRebateAgentStats: async (params?: { page?: number; pageSize?: number; start_date?: string; end_date?: string; creator_id?: number }) => {
    const { data } = await api.get('/v1/admin/rebate-stats/agents', { params })
    return data
  },

  // 返佣记录
  getRebateRecords: async (params: {
    page?: number
    pageSize?: number
    status?: string | null
    agent_id?: number
    creator_id?: number
    start_date?: string
    end_date?: string
  }) => {
    const { data } = await api.get('/v1/admin/rebate-records', { params })
    return data
  },

  getRebateRecord: async (id: number) => {
    const { data } = await api.get(`/v1/admin/rebate-records/${id}`)
    return data
  },

  reviewRebateRecord: async (id: number, payload: { conclusion: string; remark?: string }) => {
    const { data } = await api.post(`/v1/admin/rebate-records/${id}/review`, payload)
    return data
  },
}
