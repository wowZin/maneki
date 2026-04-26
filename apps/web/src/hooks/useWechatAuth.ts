/**
 * 微信认证 Hook
 * 处理微信登录状态和环境检测
 */

import { useState, useEffect, useCallback } from 'react'
import {
  isWechatBrowser,
  isMiniProgramWebView,
  autoLogin,
  redirectToWechatAuth,
  wechatMiniLogin,
  getWechatMiniPhone,
  WechatLoginResponse,
} from '../services/wechat'
import { useAuthStore } from '../stores/auth'

interface UseWechatAuthReturn {
  /**
   * 是否在微信公众号内
   */
  isWechat: boolean
  /**
   * 是否在小程序 WebView 内
   */
  isMiniProgram: boolean
  /**
   * 是否正在加载
   */
  isLoading: boolean
  /**
   * 是否显示微信登录按钮
   */
  showWechatLogin: boolean
  /**
   * 是否显示普通登录表单
   */
  showNormalLogin: boolean
  /**
   * 是否新用户（需要完善信息）
   */
  isNewUser: boolean
  /**
   * 是否需要绑定手机号
   */
  needBindPhone: boolean
  /**
   * 错误信息
   */
  error: string | null
  /**
   * 执行自动登录
   */
  tryAutoLogin: () => Promise<void>
  /**
   * 跳转到微信授权页（公众号）
   */
  handleWechatLogin: () => Promise<void>
  /**
   * 小程序登录
   */
  handleMiniProgramLogin: () => Promise<void>
  /**
   * 获取手机号并绑定
   */
  handleGetPhoneNumber: (code: string) => Promise<void>
  /**
   * 清除错误
   */
  clearError: () => void
}

export const useWechatAuth = (): UseWechatAuthReturn => {
  const [isWechat, setIsWechat] = useState(false)
  const [isMiniProgram, setIsMiniProgram] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showWechatLogin, setShowWechatLogin] = useState(false)
  const [showNormalLogin, setShowNormalLogin] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [needBindPhone, setNeedBindPhone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { login } = useAuthStore()

  // 初始化环境检测
  useEffect(() => {
    const init = async () => {
      const wechatEnv = isWechatBrowser()
      setIsWechat(wechatEnv)

      if (wechatEnv) {
        const miniEnv = await isMiniProgramWebView()
        setIsMiniProgram(miniEnv)
      } else {
        // 普通浏览器环境，直接显示普通登录表单
        setShowNormalLogin(true)
        setShowWechatLogin(false)
      }

      setIsLoading(false)
    }

    init()
  }, [])

  // 自动登录
  const tryAutoLogin = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await autoLogin({
        autoWechatLogin: true,
        onSuccess: (response: WechatLoginResponse) => {
          // 保存登录状态
          login(response.access_token, {
            id: response.user_info.id,
            nickname: response.user_info.nickname || response.user_info.username || '微信用户',
            phone: response.user_info.phone || '',
            avatar_url: response.user_info.avatar_url,
            is_active: true,
            is_superuser: false,
            is_verified: true,
          })

          setIsNewUser(response.is_new_user)
          setNeedBindPhone(response.need_bind_phone || false)
        },
        onError: (err: Error) => {
          setError(err.message || '登录失败')
        }
      })

      // 根据环境决定显示什么登录方式
      if (!result) {
        // 自动登录失败，显示对应登录入口
        if (isMiniProgram) {
          setShowWechatLogin(true)
        } else if (isWechat) {
          // 公众号环境，检查 URL 是否有 code
          const urlParams = new URLSearchParams(window.location.search)
          if (!urlParams.get('code')) {
            setShowWechatLogin(true)
          }
          setShowNormalLogin(false)
        } else {
          // 普通浏览器，显示普通登录
          setShowNormalLogin(true)
          setShowWechatLogin(false)
        }
      } else {
        // 登录成功，隐藏所有登录入口
        setShowWechatLogin(false)
        setShowNormalLogin(false)
      }
    } catch (err: any) {
      setError(err.message || '登录失败')
      setShowNormalLogin(!isWechat)
      setShowWechatLogin(isWechat || isMiniProgram)
    } finally {
      setIsLoading(false)
    }
  }, [isWechat, isMiniProgram, login])

  // 公众号登录
  const handleWechatLogin = useCallback(async () => {
    try {
      setIsLoading(true)
      await redirectToWechatAuth(window.location.href, 'snsapi_userinfo')
    } catch (err: any) {
      setError(err.message || '微信授权失败')
      setIsLoading(false)
    }
  }, [])

  // 小程序登录
  const handleMiniProgramLogin = useCallback(async () => {
    const wx = (window as any).wx
    if (!wx || !wx.login) {
      setError('请在微信小程序内使用')
      return
    }

    setIsLoading(true)
    setError(null)

    wx.login({
      success: async (res: any) => {
        if (res.code) {
          try {
            const response = await wechatMiniLogin(res.code)

            login(response.access_token, {
              id: response.user_info.id,
              nickname: response.user_info.nickname || response.user_info.username || '微信用户',
              phone: response.user_info.phone || '',
              avatar_url: response.user_info.avatar_url,
              is_active: true,
              is_superuser: false,
              is_verified: true,
            })

            setIsNewUser(response.is_new_user)
            setNeedBindPhone(response.need_bind_phone || false)
          } catch (err: any) {
            setError(err.response?.data?.detail || '登录失败')
          }
        } else {
          setError('小程序登录失败')
        }
        setIsLoading(false)
      },
      fail: (err: any) => {
        setError(err.errMsg || '小程序登录失败')
        setIsLoading(false)
      }
    })
  }, [login])

  // 获取手机号
  const handleGetPhoneNumber = useCallback(async (code: string) => {
    if (!code) {
      setError('获取手机号失败')
      return
    }

    setIsLoading(true)
    try {
      await getWechatMiniPhone(code)
      setNeedBindPhone(false)
    } catch (err: any) {
      setError(err.response?.data?.detail || '获取手机号失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isWechat,
    isMiniProgram,
    isLoading,
    showWechatLogin,
    showNormalLogin,
    isNewUser,
    needBindPhone,
    error,
    tryAutoLogin,
    handleWechatLogin,
    handleMiniProgramLogin,
    handleGetPhoneNumber,
    clearError,
  }
}
