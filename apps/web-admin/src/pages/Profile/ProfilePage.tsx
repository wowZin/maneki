/**
 * 个人资料页面
 */

import React, { useState } from 'react'
import { Card, Avatar, Descriptions, Tag, Button, Form, Input, message, Space } from 'antd'
import { LockOutlined, SafetyOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../stores/auth'
import { adminAuthApi } from '../../api/auth'

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuthStore()
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordForm] = Form.useForm()

  const handleChangePassword = async (values: {
    old_password: string
    new_password: string
    confirm_password: string
  }) => {
    if (values.new_password !== values.confirm_password) {
      message.error('两次输入的新密码不一致')
      return
    }

    setPasswordLoading(true)
    try {
      const { data: result } = await adminAuthApi.changePassword(
        values.old_password,
        values.new_password,
      )

      if (result.code === 0) {
        message.success('密码修改成功，请重新登录')
        passwordForm.resetFields()
        logout()
        setTimeout(() => {
          window.location.href = '/login'
        }, 1000)
      } else {
        message.error(result.message || '修改失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '修改失败')
    } finally {
      setPasswordLoading(false)
    }
  }

  const roleLabel = user?.role === 'super' ? '超级管理员' : '管理员'
  const roleColor = user?.role === 'super' ? 'red' : 'blue'

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>个人资料</h2>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 基本信息卡片 */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
            <Avatar
              size={80}
              style={{
                backgroundColor: '#3b82f6',
                fontSize: 32,
              }}
            >
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </Avatar>
            <div>
              <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
                {user?.name || '管理员'}
              </div>
              <Tag color={roleColor}>{roleLabel}</Tag>
              {user?.is_active === false && (
                <Tag color="default">已禁用</Tag>
              )}
            </div>
          </div>

          <Descriptions column={2} bordered>
            <Descriptions.Item label="ID">{user?.id}</Descriptions.Item>
            <Descriptions.Item label="账户名称">{user?.name}</Descriptions.Item>
            <Descriptions.Item label="角色">
              <Tag color={roleColor}>{roleLabel}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {user?.is_active !== false ? (
                <Tag color="success">正常</Tag>
              ) : (
                <Tag color="default">已禁用</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {user?.created_at || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="最后登录">
              {user?.last_login_at || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 修改密码卡片 */}
        <Card
          title={
            <Space>
              <LockOutlined />
              <span>修改密码</span>
            </Space>
          }
        >
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={handleChangePassword}
            style={{ maxWidth: 400 }}
          >
            <Form.Item
              name="old_password"
              label="当前密码"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入当前密码"
              />
            </Form.Item>

            <Form.Item
              name="new_password"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码长度至少6位' },
              ]}
            >
              <Input.Password
                prefix={<SafetyOutlined />}
                placeholder="请输入新密码"
              />
            </Form.Item>

            <Form.Item
              name="confirm_password"
              label="确认新密码"
              rules={[{ required: true, message: '请确认新密码' }]}
            >
              <Input.Password
                prefix={<SafetyOutlined />}
                placeholder="请再次输入新密码"
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={passwordLoading}>
                确认修改
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </div>
  )
}

export default ProfilePage
