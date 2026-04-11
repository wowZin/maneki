/**
 * 用户管理页面
 */

import React, { useEffect, useState } from 'react'
import {
  Table,
  Card,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  DatePicker,
  Switch,
  message,
  Popconfirm,
  Avatar,
  Row,
  Col,
  Statistic,
} from 'antd'
import {
  SearchOutlined,
  EditOutlined,
  LockOutlined,
  UnlockOutlined,
  CrownOutlined,
  UserDeleteOutlined,
} from '@ant-design/icons'
import { adminApi } from '@/services/admin'
import dayjs from 'dayjs'


interface User {
  id: string
  email: string
  username?: string
  full_name?: string
  phone?: string
  is_active: boolean
  is_superuser: boolean
  vip_level: number
  vip_expire_at?: string
  created_at: string
  last_login?: string
  register_source: string
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [searchText, setSearchText] = useState('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchUsers()
  }, [pagination.current, pagination.pageSize])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const data = await adminApi.getUsers({
        page: pagination.current,
        pageSize: pagination.pageSize,
        search: searchText,
      })
      setUsers(data.items)
      setPagination({ ...pagination, total: data.total })
    } catch (error) {
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 })
    fetchUsers()
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue({
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      phone: user.phone,
      vip_level: user.vip_level,
      vip_expire_at: user.vip_expire_at ? dayjs(user.vip_expire_at) : null,
      is_active: user.is_active,
      is_superuser: user.is_superuser,
    })
    setIsEditModalOpen(true)
  }

  const handleSave = async (values: any) => {
    try {
      if (!editingUser) return

      await adminApi.updateUser(editingUser.id, {
        ...values,
        vip_expire_at: values.vip_expire_at?.format(),
      })

      message.success('用户更新成功')
      setIsEditModalOpen(false)
      fetchUsers()
    } catch (error) {
      message.error('更新失败')
    }
  }

  const handleToggleStatus = async (user: User) => {
    try {
      await adminApi.updateUser(user.id, { is_active: !user.is_active })
      message.success(user.is_active ? '用户已禁用' : '用户已启用')
      fetchUsers()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleResetPassword = async (userId: string) => {
    try {
      await adminApi.resetUserPassword(userId)
      message.success('密码重置成功，新密码已发送至用户邮箱')
    } catch (error) {
      message.error('密码重置失败')
    }
  }

  const columns = [
    {
      title: '用户',
      key: 'user',
      render: (user: User) => (
        <Space>
          <Avatar style={{ backgroundColor: '#3b82f6' }}>
            {user.email[0].toUpperCase()}
          </Avatar>
          <div>
            <div>{user.email}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {user.username || user.full_name || '未设置昵称'}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'VIP 等级',
      dataIndex: 'vip_level',
      key: 'vip_level',
      render: (level: number, user: User) => {
        const colors = ['default', 'gold', 'purple']
        const labels = ['免费', 'VIP', 'SVIP']
        const isExpired = user.vip_expire_at && dayjs(user.vip_expire_at).isBefore(dayjs())
        return (
          <Space>
            <Tag color={colors[level] || 'default'} icon={level > 0 ? <CrownOutlined /> : null}>
              {labels[level] || '免费'}
            </Tag>
            {level > 0 && user.vip_expire_at && (
              <span style={{ fontSize: 12, color: isExpired ? '#ef4444' : '#10b981' }}>
                {isExpired ? '已过期' : dayjs(user.vip_expire_at).format('YYYY-MM-DD')}
              </span>
            )}
          </Space>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'error'}>
          {isActive ? '正常' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '注册来源',
      dataIndex: 'register_source',
      key: 'register_source',
      render: (source: string) => {
        const labels: Record<string, string> = {
          email: '邮箱',
          wechat_mp: '公众号',
          wechat_mini: '小程序',
          wechat_open: 'APP',
        }
        return labels[source] || source
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (user: User) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(user)}
          >
            编辑
          </Button>
          <Popconfirm
            title={user.is_active ? '禁用用户' : '启用用户'}
            description={`确定要${user.is_active ? '禁用' : '启用'}该用户吗？`}
            onConfirm={() => handleToggleStatus(user)}
          >
            <Button
              type="text"
              danger={user.is_active}
              icon={user.is_active ? <LockOutlined /> : <UnlockOutlined />}
            >
              {user.is_active ? '禁用' : '启用'}
            </Button>
          </Popconfirm>
          <Popconfirm
            title="重置密码"
            description="确定要重置该用户的密码吗？新密码将发送至用户邮箱。"
            onConfirm={() => handleResetPassword(user.id)}
          >
            <Button type="text" icon={<UserDeleteOutlined />}>
              重置密码
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>用户管理</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总用户数" value={pagination.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="今日新增" value={0} valueStyle={{ color: '#10b981' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="VIP 用户" value={0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="禁用用户" value={0} valueStyle={{ color: '#ef4444' }} />
          </Card>
        </Col>
      </Row>

      <Card
        title="用户列表"
        extra={
          <Space>
            <Input
              placeholder="搜索邮箱/用户名"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              style={{ width: 250 }}
            />
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={(p) => setPagination({ ...pagination, current: p.current || 1, pageSize: p.pageSize || 20 })}
        />
      </Card>

      <Modal
        title="编辑用户"
        open={isEditModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsEditModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="email" label="邮箱">
            <Input disabled />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="username" label="用户名">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="full_name" label="姓名">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="vip_level" label="VIP 等级">
                <Select
                  options={[
                    { label: '免费', value: 0 },
                    { label: 'VIP', value: 1 },
                    { label: 'SVIP', value: 2 },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="vip_expire_at" label="VIP 过期时间">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="is_active" label="账户状态" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_superuser" label="超级用户" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default Users
