import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Form, Input, Button, message, Spin } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores/auth'
import { adminAuthApi } from '../api/auth'

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  background: '#ffffff',
  borderRadius: 20,
  boxShadow: '0 16px 48px rgba(15, 23, 42, 0.12)',
  overflow: 'hidden',
}

const gradientBarStyle: React.CSSProperties = {
  height: 4,
  width: '100%',
  background: 'linear-gradient(90deg, #7c3aed, #f59e0b)',
}

const inputStyle: React.CSSProperties = {
  borderRadius: 10,
}

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { login, isAuthenticated, isLoading } = useAuthStore()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (values: { name: string; password: string }) => {
    setSubmitting(true)
    try {
      const { data: result } = await adminAuthApi.login({
        name: values.name,
        password: values.password,
      })

      if (result.code === 0 && result.data) {
        login(result.data.admin)
        message.success('登录成功')
        if (result.data.admin.force_change_password) {
          navigate('/change-password')
        } else {
          navigate('/')
        }
      } else {
        message.error(result.message || '登录失败')
      }
    } catch (error: any) {
      message.error('登录失败：' + (error.response?.data?.message || error.message || '网络错误'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decorations */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #f5f3ff 0%, #ffffff 50%, #fffbeb 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -160,
            left: -160,
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: '#a78bfa',
            opacity: 0.07,
            filter: 'blur(120px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -160,
            right: -160,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: '#f59e0b',
            opacity: 0.07,
            filter: 'blur(120px)',
          }}
        />
      </div>

      {/* Login card */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          margin: '0 16px',
          animation: 'fadeInUp 0.6s ease-out',
        }}
      >
        <div style={gradientBarStyle} />
        <div style={{ ...cardStyle, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          <div style={{ padding: '40px 40px 32px' }}>
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  margin: '0 auto 20px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(13, 148, 136, 0.25)',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
              <h1
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: '#1e293b',
                  margin: 0,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                Maneki Admin
              </h1>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 8, marginBottom: 0 }}>
                管理后台登录
              </p>
            </div>

            {/* Form */}
            <Form name="login" onFinish={handleSubmit} autoComplete="off" size="large">
              <Form.Item
                name="name"
                rules={[{ required: true, message: '请输入账户名称' }, { min: 3, message: '账户名称至少3个字符' }]}
                style={{ marginBottom: 16 }}
              >
                <Input
                  prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="账户名称"
                  autoFocus
                  style={inputStyle}
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
                style={{ marginBottom: 24 }}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="密码"
                  style={inputStyle}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  block
                  size="large"
                  style={{
                    height: 44,
                    borderRadius: 10,
                    background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                    border: 'none',
                    boxShadow: '0 8px 24px rgba(13, 148, 136, 0.25)',
                    fontSize: 16,
                    fontWeight: 500,
                  }}
                >
                  登录
                </Button>
              </Form.Item>
            </Form>

            {/* Footer */}
            <div
              style={{
                marginTop: 32,
                paddingTop: 24,
                borderTop: '1px solid #f1f5f9',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 12, color: '#cbd5e1', letterSpacing: '0.05em' }}>
                MANEKI ADMIN v1.0
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default Login
