/**
 * 用户个人信息 API 服务
 */

import api from './api'

export interface UserProfile {
  id: string
  nickname: string
  avatar_url: string
  phone: string
  vip_level: number
  vip_level_name: string
  vip_level_color: string
  vip_expire_at: string | null
  has_password: boolean
  created_at: string
}

export interface RebateSummary {
  total_rebate: number
  pending_rebate: number
  settled_rebate: number
  currency: string
}

export interface UpdateNicknameData {
  nickname: string
}

export interface ChangePasswordData {
  old_password: string
  new_password: string
  confirm_password: string
}

export const userApi = {
  // 获取当前用户个人信息
  getMe: async (): Promise<UserProfile> => {
    const response = await api.get('/users/me')
    return response.data.data
  },

  // 修改昵称
  updateNickname: async (data: UpdateNicknameData): Promise<{ id: string; nickname: string }> => {
    const response = await api.put('/users/me', data)
    return response.data.data
  },

  // 上传头像
  uploadAvatar: async (file: File): Promise<{ avatar_url: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data.data
  },

  // 修改密码
  changePassword: async (data: ChangePasswordData): Promise<void> => {
    await api.post('/users/me/password', data)
  },

  // 获取返佣汇总（仅 SVIP）
  getRebateSummary: async (): Promise<RebateSummary> => {
    const response = await api.get('/users/me/rebate')
    return response.data.data
  },
}
