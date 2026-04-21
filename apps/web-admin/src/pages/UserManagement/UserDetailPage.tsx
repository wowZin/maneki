/**
 * 用户详情页面
 */

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Button, Tag, Space, Popconfirm, message, Spin } from 'antd'
import { ArrowLeftOutlined, LockOutlined, UnlockOutlined, KeyOutlined } from '@ant-design/icons'
import { userApi, User } from '../../api/user'

const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchUser = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await userApi.detail(id)
      if (res.data.code === 0) {
        setUser(res.data.data)
      }
    } catch (error) {
      message.error('获取用户详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [id])

  const handleToggleStatus = async (enable: boolean) => {
    if (!id) return
    try {
      const res = enable ? await userApi.enable(id) : await userApi.disable(id)
      if (res.data.code === 0) {
        message.success(enable ? '启用成功' : '禁用成功')
        fetchUser()
      } else {
        message.error(res.data.message || '操作失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败')
    }
  }

  const handleResetPassword = async () => {
    if (!id) return
    try {
      const res = await userApi.resetPassword(id)
      if (res.data.code === 0) {
        message.success(`密码已重置，临时密码：${res.data.data.temp_password}`)
      } else {
        message.error(res.data.message || '重置失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '重置失败')
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!user) {
    return <div>用户不存在</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}>
            返回列表
          </Button>
          <h2 style={{ margin: 0 }}>用户详情</h2>
        </Space>
        <Space>
          {user.is_active ? (
            <Popconfirm
              title="确定禁用该用户？"
              onConfirm={() => handleToggleStatus(false)}
            >
              <Button danger icon={<LockOutlined />}>
                禁用用户
              </Button>
            </Popconfirm>
          ) : (
            <Button icon={<UnlockOutlined />} onClick={() => handleToggleStatus(true)}>
              启用用户
            </Button>
          )}
          <Popconfirm
            title="确定重置该用户密码？"
            onConfirm={handleResetPassword}
          >
            <Button icon={<KeyOutlined />}>
              重置密码
            </Button>
          </Popconfirm>
        </Space>
      </div>

      <Card>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="ID">{user.id}</Descriptions.Item>
          <Descriptions.Item label="昵称">{user.name}</Descriptions.Item>
          <Descriptions.Item label="手机号">{user.phone}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{user.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={user.is_active ? 'green' : 'default'}>
              {user.is_active ? '启用' : '禁用'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="注册时间">{user.created_at}</Descriptions.Item>
          <Descriptions.Item label="最后登录">{user.last_login_at || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}

export default UserDetailPage