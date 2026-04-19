/**
 * 管理员登录页面
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores/auth'
import { adminAuthApi } from '../api/auth'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: { name: string; password: string }) => {
    setLoading(true)
    try {
      const { data: result } = await adminAuthApi.login({
        name: values.name,
        password: values.password,
      })

      if (result.code === 0 && result.data) {
        login(result.data.admin)
        message.success('登录成功')

        // 如果强制修改密码，跳转到修改密码页
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
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card style={{ width: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 28, color: '#333' }}>Maneki Admin</h1>
          <p style={{ margin: '8px 0 0', color: '#666' }}>管理后台登录</p>
        </div>

        <Form
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="name"
            rules={[
              { required: true, message: '请输入账户名称' },
              { min: 3, message: '账户名称至少3个字符' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="账户名称"
              autoFocus
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default Login
