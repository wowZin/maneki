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
}
