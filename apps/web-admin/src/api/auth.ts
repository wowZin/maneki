import api from '../services/api'

export interface LoginParams {
  name: string
  password: string
}

export interface LoginResult {
  token: string
  admin: {
    id: number
    name: string
    role: string
    force_change_password: boolean
  }
}

export const adminAuthApi = {
  login: (params: LoginParams) =>
    api.post('/v1/admin/auth/login', params),

  logout: () =>
    api.post('/v1/admin/auth/logout'),

  me: () =>
    api.get('/v1/admin/auth/me'),

  changePassword: (oldPassword: string, newPassword: string) =>
    api.post('/v1/admin/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    }),
}
