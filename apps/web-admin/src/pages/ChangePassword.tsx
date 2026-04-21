/**
 * 强制修改密码页面
 * 管理员首次登录时（force_change_password=true）会跳转至此
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, message } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores/auth'
import { adminAuthApi } from '../api/auth'

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
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card style={{ width: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 24, color: '#333' }}>修改初始密码</h1>
          <p style={{ margin: '8px 0 0', color: '#666' }}>为了账号安全，请修改初始密码后再继续使用</p>
        </div>

        <Form
          name="change-password"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="old_password"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="当前密码（初始密码为 111111）"
            />
          </Form.Item>

          <Form.Item
            name="new_password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度至少6位' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="新密码"
            />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            rules={[{ required: true, message: '请确认新密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="确认新密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              确认修改
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default ChangePassword
