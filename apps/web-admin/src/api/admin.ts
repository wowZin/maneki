import api from '../services/api'

export interface Admin {
  id: number
  name: string
  role: string
  is_active: boolean
  created_at: string
  last_login_at?: string
}

export const adminApi = {
  list: (params?: { page?: number; page_size?: number; keyword?: string }) =>
    api.get('/v1/admin/admins', { params }),

  create: (name: string) =>
    api.post('/v1/admin/admins', { name }),

  disable: (id: number) =>
    api.post(`/v1/admin/admins/${id}/disable`),

  enable: (id: number) =>
    api.post(`/v1/admin/admins/${id}/enable`),
}
