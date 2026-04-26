/**
 * 注册页面 - 科技感主题
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
  MobileOutlined,
  StockOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../stores/auth'
import { authApi } from '../../services/api'

const { Text } = Typography

interface RegisterFormData {
  nickname: string
  phone: string
  password: string
  confirmPassword: string
}

const Register: React.FC = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { login, isAuthenticated, setError, error, clearError } = useAuthStore()
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState(false)

  // 已登录则跳转到首页
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (values: RegisterFormData) => {
    setSubmitting(true)
    clearError()

    try {
      const response = await authApi.register({
        nickname: values.nickname,
        phone: values.phone,
        password: values.password,
        confirm_password: values.confirmPassword,
      })

      message.success('注册成功！')

      // 自动登录
      const token = response.access_token
      const user = response.user
      if (token && user) {
        login(token, user)
        navigate('/')
      } else {
        setRegistered(true)
      }
    } catch (err: any) {
      let errorMsg: string
      if (!err.response) {
        errorMsg = '网络连接失败，请检查网络或稍后重试'
      } else if (err.response.status === 409) {
        errorMsg = err.response.data?.error || '该账号已被注册'
      } else {
        errorMsg = err.response.data?.error || err.response.data?.detail || '注册失败，请检查输入信息'
      }
      setError(errorMsg)
      message.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  // 注册成功后的提示页面
  if (registered) {
    return (
      <div className="auth-container">
        <div className="auth-bg-pattern" />
        <div className="auth-grid" />

        <div className="auth-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px',
            fontSize: 48,
            color: 'white',
            boxShadow: '0 10px 40px rgba(16, 185, 129, 0.4)',
            animation: 'logo-pulse 3s ease-in-out infinite'
          }}>
            <CheckCircleOutlined />
          </div>
          <h1 className="auth-title" style={{ marginBottom: 16 }}>注册成功！</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 32 }}>
            您的账号已创建成功，现在可以登录使用系统了。
          </p>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate('/login')}
            style={{
              height: 52,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              padding: '0 48px',
              background: 'linear-gradient(135deg, #f39c12, #e67e22)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(230, 126, 34, 0.35)'
            }}
          >
            去登录
          </Button>
        </div>
      </div>
    )
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
            transition: 'color 0.3s ease'
          }}
        >
          <ArrowLeftOutlined /> 返回登录
        </Link>

        <div className="auth-header">
          <div className="auth-logo">
            <StockOutlined />
          </div>
          <h1 className="auth-title">创建账号</h1>
          <p className="auth-subtitle">加入 Maneki 智能股票分析平台</p>
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

        <Form
          form={form}
          name="register"
          onFinish={handleSubmit}
          autoComplete="off"
          layout="vertical"
        >
          <Form.Item
            name="nickname"
            rules={[
              { required: true, message: '请输入昵称' },
              { min: 2, message: '昵称至少2个字符' },
              { max: 20, message: '昵称最多20个字符' },
              { pattern: /^[一-龥a-zA-Z0-9_]+$/, message: '昵称只能包含中文、字母、数字和下划线' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="昵称"
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

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
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

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
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
              placeholder="确认密码"
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
                background: 'linear-gradient(135deg, #f39c12, #e67e22)',
                border: 'none',
                boxShadow: '0 4px 14px rgba(230, 126, 34, 0.35)'
              }}
            >
              创建账号
            </Button>
          </Form.Item>
        </Form>

        <div className="tech-divider" />

        <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }}>
          <Text style={{ color: 'var(--text-secondary)' }}>
            已有账号？ <Link to="/login" style={{ color: '#d35400', fontWeight: 600 }}>立即登录</Link>
          </Text>
        </Space>
      </div>
    </div>
  )
}

export default Register
