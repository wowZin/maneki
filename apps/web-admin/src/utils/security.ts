/**
 * 安全工具函数
 */

// 生成随机 nonce
export const generateNonce = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// XSS 过滤
export const sanitizeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// 验证密码强度
export const checkPasswordStrength = (password: string): {
  score: number // 0-4
  isStrong: boolean
  message: string
} => {
  let score = 0
  const messages: string[] = []

  if (password.length >= 12) {
    score++
  } else {
    messages.push('密码至少12位')
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score++
  } else {
    messages.push('需包含大小写字母')
  }

  if (/\d/.test(password)) {
    score++
  } else {
    messages.push('需包含数字')
  }

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score++
  } else {
    messages.push('需包含特殊字符')
  }

  return {
    score,
    isStrong: score >= 3,
    message: messages.join('，') || '密码强度良好',
  }
}

// 防抖函数
export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

// 限流器
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map()
  private maxAttempts: number
  private windowMs: number

  constructor(maxAttempts = 5, windowMs = 60000) {
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
  }

  canProceed(key: string): boolean {
    const now = Date.now()
    const attempts = this.attempts.get(key) || []

    // 清理过期记录
    const validAttempts = attempts.filter((time) => now - time < this.windowMs)

    if (validAttempts.length >= this.maxAttempts) {
      return false
    }

    validAttempts.push(now)
    this.attempts.set(key, validAttempts)
    return true
  }

  getRemainingTime(key: string): number {
    const now = Date.now()
    const attempts = this.attempts.get(key) || []
    if (attempts.length === 0) return 0

    const oldestAttempt = attempts[0]
    return Math.max(0, this.windowMs - (now - oldestAttempt))
  }
}
