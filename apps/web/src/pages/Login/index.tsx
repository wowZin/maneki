/**
 * 登录页面
 * 支持邮箱登录、微信一键登录和手机号登录
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Form,
  Input,
  Button,
  Typography,
  Alert,
  Space,
  message,
  Tabs,
} from 'antd'
import {
  UserOutlined,
  LockOutlined,
  StockOutlined,
  WechatOutlined,
  MobileOutlined,
  SafetyOutlined,
} from '@ant-design/icons'

import { useAuthStore } from '../../stores/auth'
import { authApi } from '../../services/api'
import { useWechatAuth } from '../../hooks/useWechatAuth'
import { usePhoneAuth } from '../../hooks/usePhoneAuth'

const { Text } = Typography

interface LoginFormData {
  username: string
  password: string
}

interface PhoneLoginFormData {
  phone: string
  code: string
}

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [phoneForm] = Form.useForm()
  const { login, isAuthenticated, setLoading, setError, error, clearError } = useAuthStore()
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('password')

  // 微信认证相关
  const {
    isWechat,
    isMiniProgram,
    isLoading: wechatLoading,
    showWechatLogin,
    showNormalLogin,
    tryAutoLogin,
    handleWechatLogin,
    handleMiniProgramLogin,
  } = useWechatAuth()

  // 号码认证相关
  const {
    isAvailable: pnsAvailable,
    isLoading: pnsLoading,
    init: initPhoneAuth,
    checkAuthAvailable,
    getSpToken,
  } = usePhoneAuth()

  // 短信验证码相关状态
  const [countdown, setCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)
  const [phoneSubmitting, setPhoneSubmitting] = useState(false)

  // 已登录则跳转到首页
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  // 尝试自动登录（微信环境）
  useEffect(() => {
    if (isWechat || isMiniProgram) {
      tryAutoLogin()
    }
  }, [isWechat, isMiniProgram, tryAutoLogin])

  // 初始化号码认证 SDK
  useEffect(() => {
    if (activeTab === 'phone') {
      initPhoneAuth()
    }
  }, [activeTab, initPhoneAuth])

  // 验证码倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 邮箱密码登录
  const handleSubmit = async (values: LoginFormData) => {
    setSubmitting(true)
    clearError()
    setLoading(true)

    try {
      const authResponse = await authApi.login({
        username: values.username,
        password: values.password,
      })

      const token = authResponse.access_token
      useAuthStore.setState({ token })

      const user = await authApi.getCurrentUser()
      login(token, user)
      message.success('登录成功！')
      navigate('/')
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || '登录失败，请检查用户名和密码'
      setError(errorMsg)
      message.error(errorMsg)
      useAuthStore.setState({ token: null })
    } finally {
      setSubmitting(false)
      setLoading(false)
    }
  }

  // 发送短信验证码
  const handleSendCode = async () => {
    const phone = phoneForm.getFieldValue('phone')
    if (!phone) {
      message.error('请输入手机号')
      return
    }

    setSendingCode(true)
    clearError()

    try {
      await authApi.sendSMSCode({ phone })
      message.success('验证码已发送')
      setCountdown(60)
      phoneForm.setFieldsValue({ code: '' })
    } catch (err: any) {
      const errorCode = err.response?.data?.code
      const errorMsg = err.response?.data?.error || '发送失败，请稍后重试'
      const retryAfter = err.response?.data?.retry_after

      let displayMsg = errorMsg
      if (errorCode === 'rate_limited_phone') {
        displayMsg = `请 ${retryAfter || 60} 秒后再试`
      } else if (errorCode === 'rate_limited_ip') {
        displayMsg = '操作过于频繁，请稍后再试'
      }

      if (retryAfter) {
        setCountdown(retryAfter)
      }
      setError(displayMsg)
      message.error(displayMsg)
    } finally {
      setSendingCode(false)
    }
  }

  // 号码认证一键登录
  const handlePhoneVerifyLogin = async () => {
    const phone = phoneForm.getFieldValue('phone')
    if (!phone) {
      message.error('请输入手机号')
      return
    }

    setPhoneSubmitting(true)
    clearError()

    try {
      // 1. 获取认证 Token
      const tokenResult = await authApi.getPhoneAuthToken()

      // 2. 检查环境是否支持号码认证
      const available = await checkAuthAvailable(tokenResult.access_token, tokenResult.jwt_token)
      if (!available) {
        setError('当前环境不支持号码认证，请使用短信验证码登录')
        setPhoneSubmitting(false)
        return
      }

      // 3. 获取 spToken
      const spToken = await getSpToken()
      if (!spToken) {
        setError('获取验证参数失败，请重试')
        setPhoneSubmitting(false)
        return
      }

      // 4. 提交验证
      const authResponse = await authApi.verifyPhone({ phone, sp_token: spToken })

      // 5. 保存登录状态
      const token = authResponse.access_token
      useAuthStore.setState({ token })

      const user = authResponse.user
      login(token, user)
      message.success('登录成功！')
      navigate('/')
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || '登录失败，请稍后重试'
      setError(errorMsg)
      message.error(errorMsg)
      useAuthStore.setState({ token: null })
    } finally {
      setPhoneSubmitting(false)
    }
  }

  // 短信验证码登录
  const handlePhoneCodeLogin = async (values: PhoneLoginFormData) => {
    setPhoneSubmitting(true)
    clearError()

    try {
      const authResponse = await authApi.loginByCode({
        phone: values.phone,
        code: values.code,
      })

      const token = authResponse.access_token
      useAuthStore.setState({ token })

      const user = authResponse.user
      login(token, user)
      message.success('登录成功！')
      navigate('/')
    } catch (err: any) {
      const errorCode = err.response?.data?.code
      const errorMsg = err.response?.data?.error || '登录失败，请检查验证码'

      let displayMsg = errorMsg
      if (errorCode === 'invalid_code') {
        displayMsg = '验证码错误，请重新输入'
      } else if (errorCode === 'code_expired') {
        displayMsg = '验证码已过期，请重新获取'
      }

      setError(displayMsg)
      message.error(displayMsg)
      useAuthStore.setState({ token: null })
    } finally {
      setPhoneSubmitting(false)
    }
  }

  // 微信登录按钮
  const WechatLoginButton = () => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, var(--border-medium))' }} />
        <Text style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
          {showNormalLogin ? '或使用' : '一键登录'}
        </Text>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--border-medium), transparent)' }} />
      </div>

      {isMiniProgram ? (
        <Button
          type="primary"
          size="large"
          block
          icon={<WechatOutlined />}
          onClick={handleMiniProgramLogin}
          loading={wechatLoading}
          style={{
            height: 52,
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            backgroundColor: '#07C160',
            borderColor: '#07C160',
            boxShadow: '0 4px 14px rgba(7, 193, 96, 0.35)'
          }}
        >
          微信一键登录
        </Button>
      ) : (
        <Button
          type="primary"
          size="large"
          block
          icon={<WechatOutlined />}
          onClick={handleWechatLogin}
          loading={wechatLoading}
          style={{
            height: 52,
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            backgroundColor: '#07C160',
            borderColor: '#07C160',
            boxShadow: '0 4px 14px rgba(7, 193, 96, 0.35)'
          }}
        >
          {showNormalLogin ? '微信账号登录' : '微信授权登录'}
        </Button>
      )}

      {isWechat && (
        <Text style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--text-tertiary)' }}>
          点击按钮授权获取您的微信头像和昵称
        </Text>
      )}
    </>
  )

  // 手机号登录表单
  const PhoneLoginForm = () => (
    <Form
      form={phoneForm}
      name="phoneLogin"
      onFinish={handlePhoneCodeLogin}
      autoComplete="off"
      layout="vertical"
    >
      <Form.Item
        name="phone"
        rules={[
          { required: true, message: '请输入手机号' },
          { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' },
        ]}
      >
        <Input
          prefix={<MobileOutlined style={{ color: 'var(--text-tertiary)' }} />}
          placeholder="手机号"
          size="large"
          maxLength={11}
          style={{
            height: 52,
            borderRadius: 12,
            border: '1px solid var(--border-medium)',
            background: 'rgba(255, 255, 255, 0.8)'
          }}
        />
      </Form.Item>

      {pnsAvailable === true ? (
        // 号码认证模式：一键验证
        <Form.Item style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            size="large"
            block
            loading={phoneSubmitting || pnsLoading}
            onClick={handlePhoneVerifyLogin}
            style={{
              height: 52,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
            }}
          >
            一键验证
          </Button>
        </Form.Item>
      ) : (
        // 短信验证码模式
        <>
          <Form.Item
            name="code"
            rules={[
              { required: true, message: '请输入验证码' },
              { len: 6, message: '验证码为6位数字' },
            ]}
          >
            <Input
              prefix={<SafetyOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="验证码"
              size="large"
              maxLength={6}
              suffix={
                <Button
                  type="link"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || sendingCode}
                  style={{ padding: 0, height: 'auto' }}
                >
                  {countdown > 0 ? `${countdown}秒后重发` : '获取验证码'}
                </Button>
              }
              style={{
                height: 52,
                borderRadius: 12,
                border: '1px solid var(--border-medium)',
                background: 'rgba(255, 255, 255, 0.8)'
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={phoneSubmitting}
              style={{
                height: 52,
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                border: 'none',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
              }}
            >
              登录
            </Button>
          </Form.Item>
        </>
      )}

      {/* 微信登录 */}
      {showWechatLogin && <WechatLoginButton />}
    </Form>
  )

  // 加载中
  if (wechatLoading && (isWechat || isMiniProgram)) {
    return (
      <div className="auth-container">
        <div className="auth-bg-pattern" />
        <div className="auth-grid" />
        <div className="auth-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div className="tech-loading">
            <div className="tech-loading-dot" />
            <div className="tech-loading-dot" />
            <div className="tech-loading-dot" />
          </div>
          <Text style={{ display: 'block', marginTop: 24, color: 'var(--text-secondary)' }}>
            正在登录...
          </Text>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-bg-pattern" />
      <div className="auth-grid" />

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <StockOutlined />
          </div>
          <h1 className="auth-title">Maneki</h1>
          <p className="auth-subtitle">智能股票分析平台</p>
          {(isWechat || isMiniProgram) && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: 12,
              padding: '6px 14px',
              background: 'rgba(7, 193, 96, 0.1)',
              borderRadius: 20,
              color: '#07C160',
              fontSize: 13,
              fontWeight: 500
            }}>
              <WechatOutlined /> 微信环境
            </div>
          )}
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={clearError}
            style={{
              marginBottom: 24,
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}
          />
        )}

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: 'password',
              label: '账号密码登录',
              children: showNormalLogin && (
                <>
                  <Form
                    form={form}
                    name="login"
                    onFinish={handleSubmit}
                    autoComplete="off"
                    layout="vertical"
                  >
                    <Form.Item
                      name="username"
                      rules={[
                        { required: true, message: '请输入用户名或邮箱' },
                      ]}
                    >
                      <Input
                        prefix={<UserOutlined style={{ color: 'var(--text-tertiary)' }} />}
                        placeholder="用户名或邮箱"
                        size="large"
                        style={{
                          height: 52,
                          borderRadius: 12,
                          border: '1px solid var(--border-medium)',
                          background: 'rgba(255, 255, 255, 0.8)'
                        }}
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      rules={[
                        { required: true, message: '请输入密码' },
                        { min: 6, message: '密码至少6位' },
                      ]}
                    >
                      <Input.Password
                        prefix={<LockOutlined style={{ color: 'var(--text-tertiary)' }} />}
                        placeholder="密码"
                        size="large"
                        style={{
                          height: 52,
                          borderRadius: 12,
                          border: '1px solid var(--border-medium)',
                          background: 'rgba(255, 255, 255, 0.8)'
                        }}
                      />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 16 }}>
                      <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        block
                        loading={submitting}
                        style={{
                          height: 52,
                          borderRadius: 12,
                          fontSize: 16,
                          fontWeight: 600,
                          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                          border: 'none',
                          boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
                        }}
                      >
                        登录
                      </Button>
                    </Form.Item>
                  </Form>

                  {showWechatLogin && <WechatLoginButton />}

                  <div className="tech-divider" />
                  <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }}>
                    <Text style={{ color: 'var(--text-secondary)' }}>
                      还没有账号？ <Link to="/register" style={{ color: '#3b82f6', fontWeight: 600 }}>立即注册</Link>
                    </Text>
                    <Text style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                      <Link to="/pricing" style={{ color: 'var(--text-tertiary)' }}>查看会员权益 →</Link>
                    </Text>
                  </Space>
                </>
              ),
            },
            {
              key: 'phone',
              label: '手机号登录',
              children: <PhoneLoginForm />,
            },
          ]}
        />
      </div>
    </div>
  )
}

export default Login
