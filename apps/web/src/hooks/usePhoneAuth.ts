/**
 * 阿里云号码认证 H5 SDK 封装 Hook
 */

import { useState, useCallback, useRef } from 'react'

// 阿里云号码认证 SDK 类型声明
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const AliyunNumberAuth: any

interface PhoneAuthState {
  isAvailable: boolean | null
  isLoading: boolean
  error: string | null
}

interface UsePhoneAuthReturn extends PhoneAuthState {
  init: () => void
  checkAuthAvailable: (accessToken: string, jwtToken: string) => Promise<boolean>
  getSpToken: () => Promise<string | null>
}

export function usePhoneAuth(): UsePhoneAuthReturn {
  const [state, setState] = useState<PhoneAuthState>({
    isAvailable: null,
    isLoading: false,
    error: null,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdkRef = useRef<any>(null)

  const init = useCallback(() => {
    try {
      if (typeof AliyunNumberAuth === 'undefined') {
        setState((prev) => ({ ...prev, isAvailable: false, error: 'SDK 未加载' }))
        return
      }

      // 初始化号码认证 SDK
      sdkRef.current = new AliyunNumberAuth({
        // 阿里云号码认证配置
        // 具体参数参考阿里云官方文档
      })
    } catch (err) {
      setState((prev) => ({ ...prev, isAvailable: false, error: 'SDK 初始化失败' }))
    }
  }, [])

  const checkAuthAvailable = useCallback(
    async (accessToken: string, jwtToken: string): Promise<boolean> => {
      if (!sdkRef.current) {
        setState((prev) => ({ ...prev, isAvailable: false }))
        return false
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        // 调用 SDK 鉴权检查
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await new Promise<any>((resolve, reject) => {
          sdkRef.current.checkAuthAvailable(
            {
              accessToken,
              jwtToken,
            },
            (res: unknown) => resolve(res),
            (err: unknown) => reject(err)
          )
        })

        const available = result?.isAvailable === true || result?.code === 'OK'
        setState((prev) => ({ ...prev, isAvailable: available, isLoading: false }))
        return available
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isAvailable: false,
          isLoading: false,
          error: '鉴权检查失败',
        }))
        return false
      }
    },
    []
  )

  const getSpToken = useCallback(async (): Promise<string | null> => {
    if (!sdkRef.current) {
      return null
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      // 调用 SDK 获取 spToken
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await new Promise<any>((resolve, reject) => {
        sdkRef.current.getVerifyToken(
          (res: unknown) => resolve(res),
          (err: unknown) => reject(err)
        )
      })

      const spToken = result?.spToken || result?.data?.spToken || null
      setState((prev) => ({ ...prev, isLoading: false }))
      return spToken
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: '获取验证参数失败',
      }))
      return null
    }
  }, [])

  return {
    ...state,
    init,
    checkAuthAvailable,
    getSpToken,
  }
}
