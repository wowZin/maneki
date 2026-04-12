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

  // 用户管理
  getUsers: async (params: { page?: number; pageSize?: number; search?: string }) => {
    const { data } = await api.get('/admin/users', { params })
    return data
  },

  updateUser: async (userId: string, updates: any) => {
    const { data } = await api.put(`/admin/users/${userId}`, updates)
    return data
  },

  resetUserPassword: async (userId: string) => {
    const { data } = await api.post(`/admin/users/${userId}/reset-password`)
    return data
  },

  // Agent 管理
  getAgentTemplates: async (params: { page?: number; pageSize?: number; search?: string }) => {
    const { data } = await api.get('/admin/agents', { params })
    return data
  },

  updateAgentTemplate: async (agentId: string, updates: any) => {
    const { data } = await api.put(`/admin/agents/${agentId}`, updates)
    return data
  },

  // 返佣管理
  getRebates: async (params: {
    page?: number
    pageSize?: number
    search?: string
    status?: string | null
  }) => {
    const { data } = await api.get('/admin/rebates', { params })
    return data
  },

  getRebateStats: async () => {
    const { data } = await api.get('/admin/rebates/stats')
    return data
  },

  batchSettleRebates: async () => {
    const { data } = await api.post('/admin/rebates/batch-settle')
    return data
  },

  // 系统配置
  getSettings: async () => {
    const { data } = await api.get('/admin/settings')
    return data
  },

  updateSettings: async (settings: any) => {
    const { data } = await api.put('/admin/settings', settings)
    return data
  },
}
