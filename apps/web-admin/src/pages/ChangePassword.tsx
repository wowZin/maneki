/**
 * 强制修改密码页面
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import { LockOutlined } from '@ant-design/icons'
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

const ChangePassword: React.FC = () => {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: {
    old_password: string
    new_password: string
    confirm_password: string
  }) => {
    if (values.new_password !== values.confirm_password) {
      message.error('两次输入的新密码不一致')
      return
    }

    setLoading(true)
    try {
      const { data: result } = await adminAuthApi.changePassword(
        values.old_password,
        values.new_password,
      )

      if (result.code === 0) {
        message.success('密码修改成功，请重新登录')
        logout()
        navigate('/login')
      } else {
        message.error(result.message || '修改失败')
      }
    } catch (error: any) {
      message.error('修改失败：' + (error.response?.data?.message || error.message || '网络错误'))
    } finally {
      setLoading(false)
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

      {/* Card */}
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
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  margin: '0 auto 20px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(13, 148, 136, 0.25)',
                }}
              >
                <LockOutlined style={{ fontSize: 28, color: '#fff' }} />
              </div>
              <h1
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: '#1e293b',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                修改初始密码
              </h1>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 8, marginBottom: 0 }}>
                为了账号安全，请修改初始密码后再继续使用
              </p>
            </div>

            {/* Form */}
            <Form name="change-password" onFinish={handleSubmit} autoComplete="off" size="large">
              <Form.Item
                name="old_password"
                rules={[{ required: true, message: '请输入当前密码' }]}
                style={{ marginBottom: 16 }}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="当前密码（初始密码为 111111）"
                  style={inputStyle}
                />
              </Form.Item>

              <Form.Item
                name="new_password"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 6, message: '密码长度至少6位' },
                ]}
                style={{ marginBottom: 16 }}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="新密码"
                  style={inputStyle}
                />
              </Form.Item>

              <Form.Item
                name="confirm_password"
                rules={[{ required: true, message: '请确认新密码' }]}
                style={{ marginBottom: 24 }}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="确认新密码"
                  style={inputStyle}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
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
                  确认修改
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

export default ChangePassword
