/**
 * 用户管理 API 服务
 */

import api from './api'

export const userApi = {
  // 获取用户列表
  getUsers: async (params: {
    page?: number
    page_size?: number
    search?: string
    is_superuser?: boolean
    is_active?: boolean
    vip_level?: number
  }) => {
    const { data } = await api.get('/v1/admin/users', { params })
    return data
  },

  // 获取单个用户
  getUser: async (id: string) => {
    const { data } = await api.get(`/v1/admin/users/${id}`)
    return data
  },

  // 创建用户
  createUser: async (userData: {
    email: string
    username: string
    password: string
    nickname?: string
    phone?: string
    is_superuser?: boolean
    is_active?: boolean
  }) => {
    const { data } = await api.post('/v1/admin/users', userData)
    return data
  },

  // 更新用户
  updateUser: async (
    id: string,
    updates: {
      email?: string
      username?: string
      nickname?: string
      phone?: string
      is_superuser?: boolean
      is_active?: boolean
    }
  ) => {
    const { data } = await api.put(`/v1/admin/users/${id}`, updates)
    return data
  },

  // 删除用户
  deleteUser: async (id: string) => {
    const { data } = await api.delete(`/v1/admin/users/${id}`)
    return data
  },

  // 重置密码
  resetPassword: async (id: string, new_password: string) => {
    const { data } = await api.post(`/v1/admin/users/${id}/reset-password`, {
      new_password,
    })
    return data
  },

  // 切换用户状态
  toggleUserStatus: async (id: string, action: 'enable' | 'disable') => {
    const { data } = await api.post(`/v1/admin/users/${id}/toggle/${action}`)
    return data
  },

  // 获取用户统计
  getUserStats: async () => {
    const { data } = await api.get('/v1/admin/users/stats')
    return data
  },
}
