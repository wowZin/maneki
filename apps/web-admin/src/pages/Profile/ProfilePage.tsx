/**
 * 个人资料页面
 */

import React, { useState } from 'react'
import { Card, Avatar, Descriptions, Tag, Button, Form, Input, message, Space } from 'antd'
import { LockOutlined, SafetyOutlined, UserOutlined , InfoCircleOutlined } from '@ant-design/icons'
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
        setTimeout(() => { window.location.href = '/login' }, 1000)
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
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
          <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
            <UserOutlined />
          </span>
          个人资料
        </h1>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            查看账户信息与修改密码</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)] lg:col-span-2">
          <div className="flex items-center gap-6 mb-6">
            <Avatar size={80} className="bg-[#3b82f6] text-[32px]">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </Avatar>
            <div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">{user?.name || '管理员'}</div>
              <Space>
                <Tag color={roleColor}>{roleLabel}</Tag>
                {user?.is_active === false && <Tag color="default">已禁用</Tag>}
              </Space>
            </div>
          </div>

          <Descriptions column={2} bordered>
            <Descriptions.Item label="ID">{user?.id}</Descriptions.Item>
            <Descriptions.Item label="账户名称">{user?.name}</Descriptions.Item>
            <Descriptions.Item label="角色"><Tag color={roleColor}>{roleLabel}</Tag></Descriptions.Item>
            <Descriptions.Item label="状态">{user?.is_active !== false ? <Tag color="success">正常</Tag> : <Tag color="default">已禁用</Tag>}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{user?.created_at || '-'}</Descriptions.Item>
            <Descriptions.Item label="最后登录">{user?.last_login_at || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card
          title={
            <Space>
              <LockOutlined />
              <span>修改密码</span>
            </Space>
          }
          className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]"
        >
          <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
            <Form.Item name="old_password" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="请输入当前密码" />
            </Form.Item>

            <Form.Item name="new_password" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码长度至少6位' }]}>
              <Input.Password prefix={<SafetyOutlined />} placeholder="请输入新密码" />
            </Form.Item>

            <Form.Item name="confirm_password" label="确认新密码" rules={[{ required: true, message: '请确认新密码' }]}>
              <Input.Password prefix={<SafetyOutlined />} placeholder="请再次输入新密码" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={passwordLoading} className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none">
                确认修改
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  )
}

export default ProfilePage
