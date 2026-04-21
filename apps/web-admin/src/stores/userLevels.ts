import { create } from 'zustand'
import { userLevelApi, type UserLevel } from '../services/userLevel'

interface UserLevelsState {
  levels: UserLevel[]
  loading: boolean
  loaded: boolean

  fetchLevels: () => Promise<void>
  getLevelByValue: (value: number) => UserLevel | undefined
  getVisibleLevels: (minLevel: number) => UserLevel[]
}

export const useUserLevelsStore = create<UserLevelsState>((set, get) => ({
  levels: [],
  loading: false,
  loaded: false,

  fetchLevels: async () => {
    if (get().loaded) return
    set({ loading: true })
    try {
      const levels = await userLevelApi.getList()
      set({ levels, loaded: true, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  getLevelByValue: (value: number) => {
    return get().levels.find((l) => l.level_value === value)
  },

  getVisibleLevels: (minLevel: number) => {
    return get().levels.filter((l) => l.level_value >= minLevel)
  },
}))
