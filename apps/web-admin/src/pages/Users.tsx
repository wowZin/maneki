/**
 * 普通用户管理页面
 * 管理普通用户（非管理员）
 */

import React, { useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Input,
  Tag,
  Space,
  Modal,
  Form,
  Switch,
  message,
  Popconfirm,
  Avatar,
  Tooltip,
  Badge,
  Select,
} from 'antd'
import {
  EditOutlined,
  UserOutlined,
  StopOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { userApi } from '@/services/user'
import type { ColumnsType } from 'antd/es/table'

interface User {
  id: string
  email: string
  username: string
  nickname: string
  phone: string
  avatar_url: string
  is_active: boolean
  is_superuser: boolean
  is_verified: boolean
  vip_level: number
  register_source: string
  created_at: string
  updated_at: string
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [vipLevel, setVipLevel] = useState<number | undefined>(undefined)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [editForm] = Form.useForm()

  // 获取普通用户列表（不包含管理员）
  const fetchUsers = async (page = 1, pageSize = 10, search = '', vip?: number) => {
    setLoading(true)
    try {
      // 只获取普通用户（is_superuser=false）
      const data = await userApi.getUsers({
        page,
        page_size: pageSize,
        search,
        is_superuser: false,
        vip_level: vip,
      })
      setUsers(data.data || [])
      setPagination({
        current: data.page || 1,
        pageSize: data.size || 10,
        total: data.total || 0,
      })
    } catch (error: any) {
      message.error('获取用户列表失败: ' + (error.response?.data?.error || error.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // 搜索处理
  const handleSearch = () => {
    fetchUsers(1, pagination.pageSize, searchKeyword, vipLevel)
  }

  // VIP等级筛选处理
  const handleVipLevelChange = (value: number | undefined) => {
    setVipLevel(value)
    fetchUsers(1, pagination.pageSize, searchKeyword, value)
  }

  // 分页处理
  const handleTableChange = (newPagination: any) => {
    fetchUsers(newPagination.current, newPagination.pageSize, searchKeyword, vipLevel)
  }

  // 更新用户
  const handleEdit = async (values: any) => {
    if (!currentUser) return
    try {
      await userApi.updateUser(currentUser.id, {
        ...values,
        is_superuser: false, // 保持普通用户身份
        is_active: values.is_active,
      })
      message.success('用户信息更新成功')
      setIsEditModalOpen(false)
      setCurrentUser(null)
      fetchUsers()
    } catch (error: any) {
      message.error('更新失败: ' + (error.response?.data?.error || error.message))
    }
  }

  // 切换用户状态
  const handleToggleStatus = async (user: User) => {
    const action = user.is_active ? 'disable' : 'enable'
    try {
      await userApi.toggleUserStatus(user.id, action)
      message.success(`用户已${user.is_active ? '禁用' : '启用'}`)
      fetchUsers()
    } catch (error: any) {
      message.error('操作失败: ' + (error.response?.data?.error || error.message))
    }
  }

  // 删除用户
  const handleDelete = async (user: User) => {
    try {
      await userApi.deleteUser(user.id)
      message.success('用户删除成功')
      fetchUsers()
    } catch (error: any) {
      message.error('删除失败: ' + (error.response?.data?.error || error.message))
    }
  }

  // 打开编辑模态框
  const openEditModal = (user: User) => {
    setCurrentUser(user)
    editForm.setFieldsValue({
      email: user.email,
      username: user.username,
      nickname: user.nickname,
      phone: user.phone,
      is_active: user.is_active,
    })
    setIsEditModalOpen(true)
  }

  const columns: ColumnsType<User> = [
    {
      title: '用户',
      key: 'user',
      render: (_, user) => (
        <Space>
          <Avatar
            style={{ backgroundColor: '#1890ff' }}
            icon={<UserOutlined />}
          />
          <div>
            <div style={{ fontWeight: 'bold' }}>{user.username}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{user.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      render: (text) => text || '-',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      render: (text) => text || '-',
    },
    {
      title: 'VIP等级',
      key: 'vip',
      render: (_, user) => (
        user.vip_level > 0 ? (
          <Tag color="purple">VIP{user.vip_level}</Tag>
        ) : (
          <Tag>免费</Tag>
        )
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_, user) => (
        <Space>
          <Badge
            status={user.is_active ? 'success' : 'error'}
            text={user.is_active ? '启用' : '禁用'}
          />
          {!user.is_verified && <Tag color="warning">未验证</Tag>}
        </Space>
      ),
    },
    {
      title: '注册来源',
      dataIndex: 'register_source',
      key: 'register_source',
      render: (text) => <Tag>{text}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, user) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(user)}
            />
          </Tooltip>
          <Tooltip title={user.is_active ? '禁用' : '启用'}>
            <Button
              type="text"
              size="small"
              icon={user.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              danger={user.is_active}
              onClick={() => handleToggleStatus(user)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定要删除用户 ${user.username} 吗？此操作不可恢复。`}
            onConfirm={() => handleDelete(user)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>普通用户管理</h2>

      <Card
        title={
          <Space>
            <TeamOutlined />
            用户列表
            <Tag>{pagination.total} 人</Tag>
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="VIP等级筛选"
              allowClear
              style={{ width: 140 }}
              value={vipLevel}
              onChange={handleVipLevelChange}
              options={[
                { label: '免费用户', value: 0 },
                { label: 'VIP1', value: 1 },
                { label: 'VIP2', value: 2 },
                { label: 'VIP3', value: 3 },
              ]}
            />
            <Input.Search
              placeholder="搜索用户名/邮箱/手机号"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onSearch={handleSearch}
              style={{ width: 250 }}
              allowClear
            />
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
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 位用户`,
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* 编辑用户模态框 */}
      <Modal
        title="编辑用户"
        open={isEditModalOpen}
        onOk={editForm.submit}
        onCancel={() => {
          setIsEditModalOpen(false)
          setCurrentUser(null)
        }}
        okText="保存"
        cancelText="取消"
        width={500}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
            ]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item name="nickname" label="昵称">
            <Input placeholder="请输入昵称（可选）" />
          </Form.Item>

          <Form.Item name="phone" label="手机号">
            <Input placeholder="请输入手机号（可选）" />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="账户状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Users
