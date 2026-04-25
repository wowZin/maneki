/**
 * 忘记密码页面
 * 通过手机号验证码重置密码
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Form,
  Input,
  Button,
  Alert,
  message,
} from 'antd'
import {
  MobileOutlined,
  LockOutlined,
  SafetyOutlined,
  StockOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'

import { useAuthStore } from '../../stores/auth'
import { authApi } from '../../services/api'

interface ForgotPasswordFormData {
  phone: string
  code: string
  password: string
  confirmPassword: string
}

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { login, isAuthenticated, setError, error, clearError } = useAuthStore()
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)

  // 已登录则跳转到首页
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  // 验证码倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 发送验证码
  const handleSendCode = async () => {
    const phone = form.getFieldValue('phone')
    if (!phone) {
      message.error('请输入手机号')
      return
    }

    setSendingCode(true)
    clearError()

    try {
      await authApi.sendForgotPasswordCode({ phone })
      message.success('验证码已发送')
      setCountdown(60)
      form.setFieldsValue({ code: '' })
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

  // 提交重置密码
  const handleSubmit = async (values: ForgotPasswordFormData) => {
    setSubmitting(true)
    clearError()

    try {
      const response = await authApi.resetPassword({
        phone: values.phone,
        code: values.code,
        new_password: values.password,
      })

      message.success('密码重置成功！')

      // 自动登录
      const token = response.access_token
      const user = response.user
      if (token && user) {
        login(token, user)
        navigate('/')
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.code
      const errorMsg = err.response?.data?.error || '重置失败，请稍后重试'

      let displayMsg = errorMsg
      if (errorCode === 'invalid_code') {
        displayMsg = '验证码错误，请重新输入'
      } else if (errorCode === 'code_expired') {
        displayMsg = '验证码已过期，请重新获取'
      }

      setError(displayMsg)
      message.error(displayMsg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-bg-pattern" />
      <div className="auth-grid" />

      <div className="auth-card">
        {/* 返回按钮 */}
        <Link
          to="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-tertiary)',
            fontSize: 14,
            marginBottom: 24,
            transition: 'color 0.3s ease',
          }}
        >
          <ArrowLeftOutlined /> 返回登录
        </Link>

        <div className="auth-header">
          <div className="auth-logo">
            <StockOutlined />
          </div>
          <h1 className="auth-title">重置密码</h1>
          <p className="auth-subtitle">通过手机号验证码找回您的账号</p>
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
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          />
        )}

        <Form
          form={form}
          name="forgotPassword"
          onFinish={handleSubmit}
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
                background: 'rgba(255, 255, 255, 0.8)',
              }}
            />
          </Form.Item>

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
                background: 'rgba(255, 255, 255, 0.8)',
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码至少8位' },
              {
                validator(_, value) {
                  if (!value) return Promise.resolve()
                  if (!/[a-zA-Z]/.test(value)) {
                    return Promise.reject(new Error('密码必须包含字母'))
                  }
                  if (!/[0-9]/.test(value)) {
                    return Promise.reject(new Error('密码必须包含数字'))
                  }
                  return Promise.resolve()
                },
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="新密码"
              size="large"
              style={{
                height: 52,
                borderRadius: 12,
                border: '1px solid var(--border-medium)',
                background: 'rgba(255, 255, 255, 0.8)',
              }}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="确认新密码"
              size="large"
              style={{
                height: 52,
                borderRadius: 12,
                border: '1px solid var(--border-medium)',
                background: 'rgba(255, 255, 255, 0.8)',
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
                background: 'linear-gradient(135deg, #f39c12, #e67e22)',
                border: 'none',
                boxShadow: '0 4px 14px rgba(230, 126, 34, 0.35)',
              }}
            >
              重置密码
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

export default ForgotPassword
