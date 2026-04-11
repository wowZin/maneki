/**
 * 管理员认证状态管理
 */

import { create } from 'zustand'

interface User {
  id: string
  email: string
  username: string
  is_superuser: boolean
  avatar_url?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean

  // Actions
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setLoading: (loading: boolean) => void
  login: (token: string, user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
    set({ token })
  },
  setLoading: (isLoading) => set({ isLoading }),

  login: (token, user) => {
    localStorage.setItem('token', token)
    set({ token, user, isAuthenticated: true, isLoading: false })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ token: null, user: null, isAuthenticated: false, isLoading: false })
  },
}))

// 初始化：检查本地存储的 token
const initAuth = async () => {
  const token = localStorage.getItem('token')
  if (!token) {
    useAuthStore.getState().setLoading(false)
    return
  }

  try {
    // 验证 token 并获取用户信息
    const response = await fetch('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) {
      const user = await response.json()
      useAuthStore.getState().setUser(user)
    } else {
      localStorage.removeItem('token')
    }
  } catch (error) {
    console.error('Auth init error:', error)
  } finally {
    useAuthStore.getState().setLoading(false)
  }
}

initAuth()
