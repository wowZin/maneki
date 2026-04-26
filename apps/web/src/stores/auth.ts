/**
 * 认证状态管理 - Zustand Store
 * 支持 localStorage / sessionStorage 双存储策略
 */

import { create } from 'zustand'

interface User {
  id: string
  nickname: string
  phone: string
  avatar_url?: string
  vip_level?: number
  vip_tier?: string
  is_vip?: boolean
  is_active: boolean
  is_superuser: boolean
  is_verified: boolean
}

interface AuthState {
  // 状态
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  login: (token: string, user: User, rememberMe?: boolean) => void
  logout: () => void
  clearError: () => void
}

const STORAGE_KEY = 'maneki-auth-storage'

function getStorage(type: 'local' | 'session') {
  return type === 'local' ? localStorage : sessionStorage
}

function saveToStorage(token: string, user: User, type: 'local' | 'session') {
  const storage = getStorage(type)
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({ token, user, isAuthenticated: true })
  )
}

function clearAllStorage() {
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
}

function loadState() {
  // 优先从 localStorage 读取（记住我）
  const local = localStorage.getItem(STORAGE_KEY)
  if (local) {
    try {
      return JSON.parse(local)
    } catch {
      // ignore
    }
  }
  // 其次从 sessionStorage 读取
  const session = sessionStorage.getItem(STORAGE_KEY)
  if (session) {
    try {
      return JSON.parse(session)
    } catch {
      // ignore
    }
  }
  return null
}

const initialState = loadState()

export const createAuthStore = (_storageType: 'local' | 'session' = 'local') =>
  create<AuthState>((set) => ({
    user: initialState?.user ?? null,
    token: initialState?.token ?? null,
    isAuthenticated: initialState?.isAuthenticated ?? false,
    isLoading: false,
    error: null,

    setUser: (user) => set({ user }),
    setToken: (token) => set({ token, isAuthenticated: !!token }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),

    login: (token, user, rememberMe = true) => {
      if (rememberMe) {
        saveToStorage(token, user, 'local')
        sessionStorage.removeItem(STORAGE_KEY)
      } else {
        saveToStorage(token, user, 'session')
        localStorage.removeItem(STORAGE_KEY)
      }
      set({
        token,
        user,
        isAuthenticated: true,
        error: null,
      })
    },

    logout: () => {
      clearAllStorage()
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        error: null,
      })
    },

    clearError: () => set({ error: null }),
  }))

// 默认导出：localStorage 存储（向后兼容）
export const useAuthStore = createAuthStore('local')

// sessionStorage 变体（非记住我登录）
export const useSessionAuthStore = createAuthStore('session')
