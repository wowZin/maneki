/**
 * 登录页面
 * 支持邮箱登录和微信一键登录
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
} from 'antd'
import {
  UserOutlined,
  LockOutlined,
  StockOutlined,
  WechatOutlined,
} from '@ant-design/icons'

import { useAuthStore } from '../../stores/auth'
import { authApi } from '../../services/api'
import { useWechatAuth } from '../../hooks/useWechatAuth'

const { Text } = Typography

interface LoginFormData {
  username: string
  password: string
}

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { login, isAuthenticated, setLoading, setError, error, clearError } = useAuthStore()
  const [submitting, setSubmitting] = useState(false)

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

  // 邮箱密码登录
  const handleSubmit = async (values: LoginFormData) => {
    setSubmitting(true)
    clearError()
    setLoading(true)

    try {
      // 1. 登录获取 token
      const authResponse = await authApi.login({
        username: values.username,
        password: values.password,
      })

      // 2. 获取用户信息
      const token = authResponse.access_token
      useAuthStore.setState({ token }) // 临时设置 token 以便获取用户信息

      const user = await authApi.getCurrentUser()

      // 3. 保存登录状态
      login(token, user)
      message.success('登录成功！')

      // 4. 跳转到首页
      navigate('/')
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || '登录失败，请检查用户名和密码'
      setError(errorMsg)
      message.error(errorMsg)
      useAuthStore.setState({ token: null }) // 清除临时 token
    } finally {
      setSubmitting(false)
      setLoading(false)
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

        {/* 普通登录表单 */}
        {showNormalLogin && (
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
        )}

        {/* 微信登录按钮 */}
        {showWechatLogin && <WechatLoginButton />}

        {/* 注册链接 */}
        {showNormalLogin && (
          <>
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
        )}
      </div>
    </div>
  )
}

export default Login
