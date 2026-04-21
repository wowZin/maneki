/**
 * 用户详情页面
 */

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Button, Tag, Space, Popconfirm, message, Spin, Table, Empty } from 'antd'
import { ArrowLeftOutlined, LockOutlined, UnlockOutlined, KeyOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { userApi, User } from '../../api/user'
import { useUserLevelsStore } from '../../stores/userLevels'

const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const getLevelByValue = useUserLevelsStore((s) => s.getLevelByValue)

  useEffect(() => {
    useUserLevelsStore.getState().fetchLevels()
  }, [])

  const fetchUser = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await userApi.detail(id)
      if (res.data.code === 0) {
        setUser(res.data.data)
      }
    } catch {
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

  const agentColumns = [
    { title: 'Agent ID', dataIndex: 'agent_id', width: 80 },
    { title: 'Agent 名称', dataIndex: 'agent_name' },
    { title: '类型', dataIndex: 'agent_type' },
    {
      title: '订阅状态', dataIndex: 'subscription_status',
      render: (status: string) => {
        if (!status) return <Tag>未订阅</Tag>
        const colorMap: Record<string, string> = { active: 'green', expired: 'orange', cancelled: 'red' }
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>
      },
    },
    { title: '订阅到期', dataIndex: 'subscription_end_date', render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-') },
    { title: '权重', dataIndex: 'weight', render: (v: number) => v?.toFixed(2) ?? '-' },
    { title: '权重启用', dataIndex: 'is_weight_enabled', render: (v: boolean) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>) },
    { title: '评分', dataIndex: 'agent_rating' },
    { title: '使用次数', dataIndex: 'agent_use_count' },
  ]

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto p-4 md:p-6 text-center py-10">
        <Spin size="large" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-[1440px] mx-auto p-4 md:p-6">
        <div className="text-center py-20 text-[var(--color-text-secondary)]">用户不存在</div>
      </div>
    )
  }

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}>返回列表</Button>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
            <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
              <UserOutlined />
            </span>
            用户详情
          </h1>
        </div>
        <Space>
          {user.is_active ? (
            <Popconfirm title="确定禁用该用户？" onConfirm={() => handleToggleStatus(false)}>
              <Button danger icon={<LockOutlined />}>禁用用户</Button>
            </Popconfirm>
          ) : (
            <Button icon={<UnlockOutlined />} onClick={() => handleToggleStatus(true)}>启用用户</Button>
          )}
          <Popconfirm title="确定重置该用户密码？" onConfirm={handleResetPassword}>
            <Button icon={<KeyOutlined />}>重置密码</Button>
          </Popconfirm>
        </Space>
      </div>

      <Card title="基本信息" className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)] mb-4">
        <Descriptions bordered column={2}>
          <Descriptions.Item label="ID">{user.id}</Descriptions.Item>
          <Descriptions.Item label="昵称">{user.name}</Descriptions.Item>
          <Descriptions.Item label="手机号">{user.phone}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{user.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="等级">{
            (() => {
              const l = getLevelByValue(user.vip_level ?? 0)
              return l ? <Tag color={l.color || 'default'}>{l.name}</Tag> : <Tag>等级 {user.vip_level}</Tag>
            })()
          }</Descriptions.Item>
          <Descriptions.Item label="打板准确率">{user.board_accuracy != null ? `${user.board_accuracy.toFixed(2)}%` : '--'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={user.is_active ? 'green' : 'default'}>{user.is_active ? '启用' : '禁用'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="注册时间">{user.created_at}</Descriptions.Item>
          <Descriptions.Item label="最后登录">{user.last_login_at || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Agent 数据" className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
        {user.agents && user.agents.length > 0 ? (
          <Table rowKey="agent_id" columns={agentColumns} dataSource={user.agents} pagination={false} size="small" />
        ) : (
          <Empty description="暂无 Agent 数据" />
        )}
      </Card>
    </div>
  )
}

export default UserDetailPage
