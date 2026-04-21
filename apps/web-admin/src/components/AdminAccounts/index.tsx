/**
 * 管理员账户管理组件
 * 放在系统设置下，与普通用户管理区分开
 * 只有超管可以操作
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
  Alert,
  Typography,
  Tooltip,
  Avatar,
  Badge,
} from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  CrownOutlined,
  StopOutlined,
  CheckCircleOutlined,
  SafetyOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { userApi } from '@/services/user'
import { useAuthStore } from '@/stores/auth'
import type { ColumnsType } from 'antd/es/table'

const { Text, Paragraph } = Typography

interface AdminUser {
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

const AdminAccounts: React.FC = () => {
  const { user: _currentUser } = useAuthStore()
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isResetPwdModalOpen, setIsResetPwdModalOpen] = useState(false)
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [pwdForm] = Form.useForm()

  // 获取管理员列表
  const fetchAdmins = async (page = 1, pageSize = 10, search = '') => {
    setLoading(true)
    try {
      // 只获取管理员（is_superuser=true）
      const data = await userApi.getUsers({
        page,
        page_size: pageSize,
        search,
        is_superuser: true,
      })
      setAdmins(data.data || [])
      setPagination({
        current: data.page || 1,
        pageSize: data.size || 10,
        total: data.total || 0,
      })
    } catch (error: any) {
      message.error('获取管理员列表失败: ' + (error.response?.data?.error || error.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdmins()
  }, [])

  // 搜索处理
  const handleSearch = () => {
    fetchAdmins(1, pagination.pageSize, searchKeyword)
  }

  // 分页处理
  const handleTableChange = (newPagination: any) => {
    fetchAdmins(newPagination.current, newPagination.pageSize, searchKeyword)
  }

  // 创建管理员
  const handleCreate = async (values: any) => {
    try {
      await userApi.createUser({
        ...values,
        is_active: values.is_active !== false,
        is_superuser: true, // 强制设置为管理员
      })
      message.success('管理员创建成功')
      setIsCreateModalOpen(false)
      form.resetFields()
      fetchAdmins()
    } catch (error: any) {
      message.error('创建失败: ' + (error.response?.data?.error || error.message))
    }
  }

  // 更新管理员
  const handleEdit = async (values: any) => {
    if (!currentAdmin) return
    try {
      await userApi.updateUser(currentAdmin.id, {
        ...values,
        is_superuser: true, // 保持管理员身份
        is_active: values.is_active,
      })
      message.success('管理员信息更新成功')
      setIsEditModalOpen(false)
      setCurrentAdmin(null)
      fetchAdmins()
    } catch (error: any) {
      message.error('更新失败: ' + (error.response?.data?.error || error.message))
    }
  }

  // 删除管理员
  const handleDelete = async (admin: AdminUser) => {
    try {
      await userApi.deleteUser(admin.id)
      message.success('管理员删除成功')
      fetchAdmins()
    } catch (error: any) {
      message.error('删除失败: ' + (error.response?.data?.error || error.message))
    }
  }

  // 重置密码
  const handleResetPassword = async (values: any) => {
    if (!currentAdmin) return
    try {
      await userApi.resetPassword(currentAdmin.id, values.new_password)
      message.success('密码重置成功')
      setIsResetPwdModalOpen(false)
      pwdForm.resetFields()
      setCurrentAdmin(null)
    } catch (error: any) {
      message.error('重置密码失败: ' + (error.response?.data?.error || error.message))
    }
  }

  // 切换管理员状态
  const handleToggleStatus = async (admin: AdminUser) => {
    const action = admin.is_active ? 'disable' : 'enable'
    try {
      await userApi.toggleUserStatus(admin.id, action)
      message.success(`管理员已${admin.is_active ? '禁用' : '启用'}`)
      fetchAdmins()
    } catch (error: any) {
      message.error('操作失败: ' + (error.response?.data?.error || error.message))
    }
  }

  // 打开编辑模态框
  const openEditModal = (admin: AdminUser) => {
    setCurrentAdmin(admin)
    editForm.setFieldsValue({
      email: admin.email,
      username: admin.username,
      nickname: admin.nickname,
      phone: admin.phone,
      is_active: admin.is_active,
    })
    setIsEditModalOpen(true)
  }

  // 打开重置密码模态框
  const openResetPwdModal = (admin: AdminUser) => {
    setCurrentAdmin(admin)
    pwdForm.resetFields()
    setIsResetPwdModalOpen(true)
  }

  const columns: ColumnsType<AdminUser> = [
    {
      title: '管理员',
      key: 'admin',
      render: (_, admin) => (
        <Space>
          <Avatar
            style={{ backgroundColor: '#faad14' }}
            icon={<CrownOutlined />}
          />
          <div>
            <div style={{ fontWeight: 'bold' }}>
              {admin.username}
              <Tag color="gold" style={{ marginLeft: 8 }}>
                超级管理员
              </Tag>
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>{admin.email}</div>
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
      title: '状态',
      key: 'status',
      render: (_, admin) => (
        <Badge
          status={admin.is_active ? 'success' : 'error'}
          text={admin.is_active ? '启用' : '禁用'}
        />
      ),
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
      render: (_, admin) => {
        // 超管账号仅展示，不允许在Web界面操作
        if (admin.is_superuser) {
          return (
            <Tooltip title="超管账号仅可通过命令行操作">
              <Tag icon={<WarningOutlined />} color="warning">
                仅命令行可操作
              </Tag>
            </Tooltip>
          )
        }
        return (
          <Space size="small">
            <Tooltip title="编辑">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditModal(admin)}
              />
            </Tooltip>
            <Tooltip title="重置密码">
              <Button
                type="text"
                size="small"
                icon={<LockOutlined />}
                onClick={() => openResetPwdModal(admin)}
              />
            </Tooltip>
            <Tooltip title={admin.is_active ? '禁用' : '启用'}>
              <Button
                type="text"
                size="small"
                icon={admin.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                danger={admin.is_active}
                onClick={() => handleToggleStatus(admin)}
              />
            </Tooltip>
            <Popconfirm
              title="确认删除"
              description={`确定要删除管理员 ${admin.username} 吗？此操作不可恢复。`}
              onConfirm={() => handleDelete(admin)}
              okText="确定"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="删除">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <Alert
        message="管理员账户管理"
        description={
          <Paragraph>
            此处仅显示具有超级管理员权限的账户。超级管理员拥有系统的最高权限，可以访问所有功能。
            <br />
            <Text type="danger">
              <WarningOutlined /> 安全策略：超管账号仅可查看，所有操作（创建、编辑、删除、禁用、重置密码）必须通过命令行执行。
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              命令行工具：go run cmd/admin/main.go [create|list|reset-password|delete|disable|enable]
            </Text>
          </Paragraph>
        }
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card
        title={
          <Space>
            <SafetyOutlined />
            管理员账户列表
            <Tag color="gold">{pagination.total} 人</Tag>
          </Space>
        }
        extra={
          <Space>
            <Input.Search
              placeholder="搜索用户名/邮箱"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onSearch={handleSearch}
              style={{ width: 220 }}
              allowClear
            />
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={admins}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 位管理员`,
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* 创建管理员模态框 */}
      <Modal
        title="添加管理员"
        open={isCreateModalOpen}
        onOk={form.submit}
        onCancel={() => {
          setIsCreateModalOpen(false)
          form.resetFields()
        }}
        okText="创建"
        cancelText="取消"
        width={500}
      >
        <Alert
          message="创建的管理员将拥有超级管理员权限"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ is_active: true }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 50, message: '用户名最多50个字符' },
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

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
          >
            <Input.Password placeholder="请输入密码" />
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
            <Switch checkedChildren="启用" unCheckedChildren="禁用" defaultChecked />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑管理员模态框 */}
      <Modal
        title="编辑管理员"
        open={isEditModalOpen}
        onOk={editForm.submit}
        onCancel={() => {
          setIsEditModalOpen(false)
          setCurrentAdmin(null)
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

      {/* 重置密码模态框 */}
      <Modal
        title="重置密码"
        open={isResetPwdModalOpen}
        onOk={pwdForm.submit}
        onCancel={() => {
          setIsResetPwdModalOpen(false)
          setCurrentAdmin(null)
        }}
        okText="重置"
        cancelText="取消"
      >
        <Form form={pwdForm} layout="vertical" onFinish={handleResetPassword}>
          <p style={{ marginBottom: 16 }}>
            正在为管理员 <strong>{currentAdmin?.username}</strong> 重置密码
          </p>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认密码"
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminAccounts