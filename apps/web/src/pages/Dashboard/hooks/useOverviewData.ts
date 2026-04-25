import { useState, useEffect, useCallback } from 'react'
import { overviewApi } from '../../../services/overview'
import type {
  AccuracyTrendResponse,
  UserTrackingTrendResponse,
  AgentPerformanceResponse,
  HotStocksResponse,
  RealtimeSignalsResponse,
} from '../../../services/overview'

interface OverviewDataState {
  accuracyTrend: AccuracyTrendResponse | null
  userTrackingTrend: UserTrackingTrendResponse | null
  agentPerformance: AgentPerformanceResponse | null
  hotStocks: HotStocksResponse | null
  realtimeSignals: RealtimeSignalsResponse | null
  loading: {
    accuracyTrend: boolean
    userTrackingTrend: boolean
    agentPerformance: boolean
    hotStocks: boolean
    realtimeSignals: boolean
  }
  errors: {
    accuracyTrend: string | null
    userTrackingTrend: string | null
    agentPerformance: string | null
    hotStocks: string | null
    realtimeSignals: string | null
  }
}

const initialState: OverviewDataState = {
  accuracyTrend: null,
  userTrackingTrend: null,
  agentPerformance: null,
  hotStocks: null,
  realtimeSignals: null,
  loading: {
    accuracyTrend: false,
    userTrackingTrend: false,
    agentPerformance: false,
    hotStocks: false,
    realtimeSignals: false,
  },
  errors: {
    accuracyTrend: null,
    userTrackingTrend: null,
    agentPerformance: null,
    hotStocks: null,
    realtimeSignals: null,
  },
}

export function useOverviewData() {
  const [state, setState] = useState<OverviewDataState>(initialState)

  const setLoading = useCallback((key: keyof OverviewDataState['loading'], value: boolean) => {
    setState((prev) => ({
      ...prev,
      loading: { ...prev.loading, [key]: value },
    }))
  }, [])

  const setError = useCallback((key: keyof OverviewDataState['errors'], value: string | null) => {
    setState((prev) => ({
      ...prev,
      errors: { ...prev.errors, [key]: value },
    }))
  }, [])

  const setData = useCallback(<K extends keyof Omit<OverviewDataState, 'loading' | 'errors'>>(
    key: K,
    value: OverviewDataState[K]
  ) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }, [])

  const fetchAccuracyTrend = useCallback(async (period = '7d') => {
    setLoading('accuracyTrend', true)
    setError('accuracyTrend', null)
    try {
      const res = await overviewApi.getAccuracyTrend(period)
      setData('accuracyTrend', res)
    } catch (e: any) {
      setError('accuracyTrend', e?.response?.data?.error?.message || '加载失败')
    } finally {
      setLoading('accuracyTrend', false)
    }
  }, [])

  const fetchUserTrackingTrend = useCallback(async (period = '7d') => {
    setLoading('userTrackingTrend', true)
    setError('userTrackingTrend', null)
    try {
      const res = await overviewApi.getUserTrackingTrend(period)
      setData('userTrackingTrend', res)
    } catch (e: any) {
      if (e?.response?.status === 401) {
        setError('userTrackingTrend', '请先登录')
      } else {
        setError('userTrackingTrend', e?.response?.data?.error?.message || '加载失败')
      }
    } finally {
      setLoading('userTrackingTrend', false)
    }
  }, [])

  const fetchAgentPerformance = useCallback(async (period = '7d') => {
    setLoading('agentPerformance', true)
    setError('agentPerformance', null)
    try {
      const res = await overviewApi.getAgentPerformance(period)
      setData('agentPerformance', res)
    } catch (e: any) {
      setError('agentPerformance', e?.response?.data?.error?.message || '加载失败')
    } finally {
      setLoading('agentPerformance', false)
    }
  }, [])

  const fetchHotStocks = useCallback(async () => {
    setLoading('hotStocks', true)
    setError('hotStocks', null)
    try {
      const res = await overviewApi.getHotStocks(20)
      setData('hotStocks', res)
    } catch (e: any) {
      setError('hotStocks', e?.response?.data?.error?.message || '加载失败')
    } finally {
      setLoading('hotStocks', false)
    }
  }, [])

  const fetchRealtimeSignals = useCallback(async () => {
    setLoading('realtimeSignals', true)
    setError('realtimeSignals', null)
    try {
      const res = await overviewApi.getRealtimeSignals(10)
      setData('realtimeSignals', res)
    } catch (e: any) {
      setError('realtimeSignals', e?.response?.data?.error?.message || '加载失败')
    } finally {
      setLoading('realtimeSignals', false)
    }
  }, [])

  const fetchAll = useCallback(() => {
    fetchAccuracyTrend()
    fetchUserTrackingTrend()
    fetchAgentPerformance()
    fetchHotStocks()
    fetchRealtimeSignals()
  }, [fetchAccuracyTrend, fetchUserTrackingTrend, fetchAgentPerformance, fetchHotStocks, fetchRealtimeSignals])

  useEffect(() => {
    fetchAll()
  }, [])

  return {
    ...state,
    fetchAccuracyTrend,
    fetchUserTrackingTrend,
    fetchAgentPerformance,
    fetchHotStocks,
    fetchRealtimeSignals,
    fetchAll,
  }
}
