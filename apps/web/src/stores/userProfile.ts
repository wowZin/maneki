/**
 * 用户个人信息状态管理 - Zustand Store
 */

import { create } from 'zustand'
import { userApi, type UserProfile, type RebateSummary } from '../services/user'

interface UserProfileState {
  // 状态
  profile: UserProfile | null
  rebate: RebateSummary | null
  isLoading: boolean
  isRebateLoading: boolean
  error: string | null

  // Actions
  fetchProfile: () => Promise<void>
  fetchRebate: () => Promise<void>
  updateNickname: (nickname: string) => Promise<void>
  updateAvatar: (avatarUrl: string) => void
  clearError: () => void
}

export const useUserProfileStore = create<UserProfileState>((set, get) => ({
  profile: null,
  rebate: null,
  isLoading: false,
  isRebateLoading: false,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null })
    try {
      const profile = await userApi.getMe()
      set({ profile, isLoading: false })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || '获取个人信息失败',
        isLoading: false,
      })
    }
  },

  fetchRebate: async () => {
    const { profile } = get()
    if (!profile || profile.vip_level < 2) {
      set({ rebate: null })
      return
    }
    set({ isRebateLoading: true })
    try {
      const rebate = await userApi.getRebateSummary()
      set({ rebate, isRebateLoading: false })
    } catch (err: any) {
      // 非SVIP返回403是正常的，不展示错误
      if (err.response?.status === 403) {
        set({ rebate: null, isRebateLoading: false })
      } else {
        set({ isRebateLoading: false })
      }
    }
  },

  updateNickname: async (nickname: string) => {
    set({ isLoading: true, error: null })
    try {
      await userApi.updateNickname({ nickname })
      const { profile } = get()
      if (profile) {
        set({ profile: { ...profile, nickname }, isLoading: false })
      }
    } catch (err: any) {
      set({
        error: err.response?.data?.message || '修改昵称失败',
        isLoading: false,
      })
      throw err
    }
  },

  updateAvatar: (avatarUrl: string) => {
    const { profile } = get()
    if (profile) {
      set({ profile: { ...profile, avatar_url: avatarUrl } })
    }
  },

  clearError: () => set({ error: null }),
}))
