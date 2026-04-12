/**
 * 微信认证服务
 * 支持公众号 OAuth 和小程序登录
 */

import api from './api'

// ========== 类型定义 ==========

export interface WechatMPConfig {
  app_id: string
  timestamp: string
  nonce_str: string
  signature: string
  oauth_url?: string
}

export interface WechatMiniConfig {
  app_id: string
}

export interface WechatLoginResponse {
  access_token: string
  token_type: string
  user_info: {
    id: string
    username: string
    nickname?: string
    avatar_url?: string
    phone?: string
  }
  is_new_user: boolean
  need_bind_phone?: boolean
}

export interface BindWechatResponse {
  success: boolean
  message: string
  wechat_unionid?: string
}

// ========== 环境检测 ==========

/**
 * 检测是否在微信公众号内
 */
export const isWechatBrowser = (): boolean => {
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('micromessenger')
}

/**
 * 检测是否在小程序 WebView 内
 */
export const isMiniProgramWebView = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!isWechatBrowser()) {
      resolve(false)
      return
    }

    // 调用 wx.miniProgram.getEnv 检测
    if ((window as any).__wxjs_environment === 'miniprogram') {
      resolve(true)
      return
    }

    // 备用检测方式
    const check = () => {
      const wx = (window as any).wx
      if (wx && wx.miniProgram) {
        wx.miniProgram.getEnv((res: any) => {
          resolve(res.miniprogram)
        })
      } else {
        resolve(false)
      }
    }

    // 等待微信 JS-SDK 加载
    if (document.readyState === 'complete') {
      check()
    } else {
      window.addEventListener('load', check)
    }
  })
}

// ========== 公众号 OAuth ==========

/**
 * 获取公众号 JS-SDK 配置
 */
export const getWechatMPConfig = async (redirectUri?: string): Promise<WechatMPConfig> => {
  const response = await api.get('/wechat/mp/config', {
    params: { redirect_uri: redirectUri }
  })
  return response.data
}

/**
 * 公众号 OAuth 登录
 * @param code 微信授权返回的 code
 */
export const wechatMPLogin = async (code: string): Promise<WechatLoginResponse> => {
  const response = await api.post('/wechat/mp/login', { code })
  return response.data
}

/**
 * 初始化微信 JS-SDK
 * 用于调用扫一扫、定位等功能
 */
export const initWechatJSSDK = async (jsApiList: string[] = []): Promise<void> => {
  const wx = (window as any).wx
  if (!wx) {
    console.warn('微信 JS-SDK 未加载')
    return
  }

  // 获取配置
  const config = await getWechatMPConfig()

  return new Promise((resolve, reject) => {
    wx.config({
      debug: false,
      appId: config.app_id,
      timestamp: config.timestamp,
      nonceStr: config.nonce_str,
      signature: config.signature,
      jsApiList: jsApiList.length > 0 ? jsApiList : [
        'scanQRCode',
        'getLocation',
        'chooseImage',
        'previewImage',
      ]
    })

    wx.ready(() => {
      console.log('微信 JS-SDK 初始化成功')
      resolve()
    })

    wx.error((err: any) => {
      console.error('微信 JS-SDK 初始化失败:', err)
      reject(err)
    })
  })
}

// ========== 小程序登录 ==========

/**
 * 获取小程序配置
 */
export const getWechatMiniConfig = async (): Promise<WechatMiniConfig> => {
  const response = await api.get('/wechat/mini/config')
  return response.data
}

/**
 * 小程序登录
 * 注意：此函数在小程序端调用，H5 环境无效
 */
export const wechatMiniLogin = async (code: string): Promise<WechatLoginResponse> => {
  const response = await api.post('/wechat/mini/login', { code })
  return response.data
}

/**
 * 获取小程序手机号
 * @param code 小程序 getPhoneNumber 接口返回的 code
 */
export const getWechatMiniPhone = async (code: string) => {
  const response = await api.post('/wechat/mini/phone', { code })
  return response.data
}

// ========== 绑定/解绑 ==========

/**
 * 绑定微信账号
 */
export const bindWechat = async (code: string, bindType: 'mp' | 'mini'): Promise<BindWechatResponse> => {
  const response = await api.post('/wechat/bind', {
    code,
    bind_type: bindType
  })
  return response.data
}

/**
 * 解绑微信账号
 */
export const unbindWechat = async (unbindType: 'mp' | 'mini' | 'all') => {
  const response = await api.post('/wechat/unbind', null, {
    params: { unbind_type: unbindType }
  })
  return response.data
}

// ========== 统一登录入口 ==========

export interface AutoLoginOptions {
  /**
   * 是否自动尝试微信登录
   * 默认 true
   */
  autoWechatLogin?: boolean
  /**
   * 登录成功回调
   */
  onSuccess?: (response: WechatLoginResponse) => void
  /**
   * 登录失败回调
   */
  onError?: (error: Error) => void
  /**
   * 需要用户确认时回调（非静默登录场景）
   */
  onNeedConfirm?: () => void
}

/**
 * 智能登录入口
 * 根据环境自动选择登录方式
 */
export const autoLogin = async (options: AutoLoginOptions = {}): Promise<WechatLoginResponse | null> => {
  const { autoWechatLogin = true, onSuccess, onError } = options

  // 1. 检查是否有 token（已登录）
  const token = localStorage.getItem('maneki-auth-storage')
  if (token) {
    // 有 token，尝试获取用户信息验证
    try {
      const response = await api.get('/auth/users/me')
      const userData = response.data
      const loginResponse: WechatLoginResponse = {
        access_token: JSON.parse(token).state?.token || '',
        token_type: 'bearer',
        user_info: {
          id: userData.id,
          username: userData.username,
          nickname: userData.nickname,
          avatar_url: userData.avatar_url,
          phone: userData.phone,
        },
        is_new_user: false,
        need_bind_phone: !userData.phone && userData.is_wechat_user,
      }
      onSuccess?.(loginResponse)
      return loginResponse
    } catch {
      // token 无效，继续尝试其他方式
      localStorage.removeItem('maneki-auth-storage')
    }
  }

  // 2. 如果不是自动微信登录，返回 null
  if (!autoWechatLogin) {
    return null
  }

  // 3. 检测是否在小程序环境
  const isInMiniProgram = await isMiniProgramWebView()
  if (isInMiniProgram) {
    // 小程序环境，调用小程序登录
    const wx = (window as any).wx
    if (wx && wx.login) {
      return new Promise((resolve, reject) => {
        wx.login({
          success: async (res: any) => {
            if (res.code) {
              try {
                const loginRes = await wechatMiniLogin(res.code)
                onSuccess?.(loginRes)
                resolve(loginRes)
              } catch (err) {
                onError?.(err as Error)
                reject(err)
              }
            } else {
              const error = new Error('小程序登录失败')
              onError?.(error)
              reject(error)
            }
          },
          fail: (err: any) => {
            onError?.(err)
            reject(err)
          }
        })
      })
    }
  }

  // 4. 检测是否在公众号环境
  if (isWechatBrowser()) {
    // 检查 URL 是否有 code（刚从授权页返回）
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')

    if (code) {
      // 有 code，直接登录
      try {
        const loginRes = await wechatMPLogin(code)
        // 清除 URL 中的 code
        window.history.replaceState({}, '', window.location.pathname)
        onSuccess?.(loginRes)
        return loginRes
      } catch (err) {
        onError?.(err as Error)
        return null
      }
    }

    // 没有 code，返回 null，让页面显示微信登录按钮
    return null
  }

  // 5. 普通浏览器环境
  return null
}

/**
 * 跳转到微信授权页
 * @param redirectUri 授权后重定向地址
 * @param scope 授权类型：snsapi_base（静默）或 snsapi_userinfo（需确认）
 */
export const redirectToWechatAuth = async (
  redirectUri: string = window.location.href,
  scope: 'snsapi_base' | 'snsapi_userinfo' = 'snsapi_userinfo'
): Promise<void> => {
  const config = await getWechatMPConfig(redirectUri)

  if (config.oauth_url) {
    window.location.href = config.oauth_url
  } else {
    // 手动拼接授权链接
    const encodedUri = encodeURIComponent(redirectUri)
    const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${config.app_id}&redirect_uri=${encodedUri}&response_type=code&scope=${scope}&state=STATE#wechat_redirect`
    window.location.href = authUrl
  }
}
