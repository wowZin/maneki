/**
 * 管理后台布局组件
 */

import React, { useState, useEffect } from 'react'
import { Layout, Menu, Button, Avatar, Dropdown, Space, Badge, theme, Popover, List, Modal, Empty, Divider, Typography } from 'antd'
import {
  DashboardOutlined,
  UserOutlined,
  SettingOutlined,
  RobotOutlined,
  GiftOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  ArrowLeftOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  TrophyOutlined,
  DollarOutlined,
  SafetyOutlined,
  BankOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  AuditOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notification'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

const { Header, Sider, Content } = Layout

dayjs.extend(relativeTime)

const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailContent, setDetailContent] = useState<{ title: string; content: string; created_at: string } | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { token } = theme.useToken()

  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const notifications = useNotificationStore((s) => s.notifications)
  const fetchStats = useNotificationStore((s) => s.fetchStats)
  const fetchList = useNotificationStore((s) => s.fetchList)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)

  // 轮询未读通知数
  useEffect(() => {
    fetchStats()
    const interval = setInterval(() => {
      fetchStats()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  // Popover 打开时拉取列表
  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      fetchList({ page: 1, pageSize: 5 })
    }
  }

  const handleClickNotification = async (item: any) => {
    if (!item.is_read) {
      await markRead(item.id)
    }
    setDetailContent({
      title: item.title,
      content: item.content,
      created_at: item.created_at,
    })
    setDetailModalOpen(true)
  }

  const notificationPopoverContent = (
    <div style={{ width: 360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Typography.Text strong>通知中心</Typography.Text>
        {unreadCount > 0 && (
          <Button type="link" size="small" onClick={markAllRead}>
            全部已读
          </Button>
        )}
      </div>
      <Divider style={{ margin: '8px 0' }} />
      {notifications.length === 0 ? (
        <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={notifications}
          renderItem={(item: any) => (
            <List.Item
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: item.is_read ? 'transparent' : '#f0f7ff',
                borderRadius: 6,
              }}
              onClick={() => handleClickNotification(item)}
            >
              <List.Item.Meta
                avatar={
                  item.type === 'task_failed' ? (
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                  ) : (
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                  )
                }
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Typography.Text
                      ellipsis
                      style={{ maxWidth: 220, fontWeight: item.is_read ? 'normal' : 'bold' }}
                    >
                      {item.title}
                    </Typography.Text>
                    {!item.is_read && <Badge status="processing" />}
                  </div>
                }
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(item.created_at).fromNow()}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      )}
      <Divider style={{ margin: '8px 0' }} />
      <Button type="link" block onClick={() => navigate('/notifications')}>
        查看全部通知
      </Button>
    </div>
  )

  // 基础菜单项（所有管理员可见）
  const baseMenuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '概览',
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: '用户管理',
    },
    {
      key: '/agents',
      icon: <RobotOutlined />,
      label: 'Agent 管理',
    },
    {
      key: 'rebates',
      icon: <GiftOutlined />,
      label: '返佣管理',
      children: [
        {
          key: '/rebates',
          icon: <DollarOutlined />,
          label: '返佣数据',
        },
        {
          key: '/settings/rebate',
          icon: <SettingOutlined />,
          label: '规则设置',
        },
      ],
    },
    {
      key: 'datasource',
      icon: <DatabaseOutlined />,
      label: '数据源管理',
      children: [
        {
          key: '/datasource/news',
          icon: <FileTextOutlined />,
          label: '新闻资讯',
        },
        {
          key: '/datasource/top-list',
          icon: <TrophyOutlined />,
          label: '龙虎榜数据',
        },
        {
          key: '/datasource/top-inst',
          icon: <BankOutlined />,
          label: '龙虎榜机构交易名单',
        },
        {
          key: '/datasource/hot-money',
          icon: <TeamOutlined />,
          label: '游资名录',
        },
      ],
    },
    {
      key: '/audit-logs',
      icon: <AuditOutlined />,
      label: '操作日志',
    },
  ]

  // 超级管理员专属菜单
  const superMenuItems = [
    {
      key: '/admin-settings',
      icon: <SafetyOutlined />,
      label: '管理员设置',
    },
  ]

  // 根据角色合并菜单
  const menuItems = user?.role === 'super'
    ? [...baseMenuItems, ...superMenuItems]
    : baseMenuItems

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ]

  const handleMenuClick = (key: string) => {
    if (key === 'logout') {
      logout()
      navigate('/login')
    } else if (key === 'profile') {
      navigate('/profile')
    } else {
      navigate(key)
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        style={{
          boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
          zIndex: 10,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Space>
            <RobotOutlined style={{ fontSize: 24, color: token.colorPrimary }} />
            {!collapsed && (
              <span style={{ fontSize: 18, fontWeight: 'bold' }}>管理后台</span>
            )}
          </Space>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => handleMenuClick(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <Link to="/">
              <Button type="text" icon={<ArrowLeftOutlined />}>
                返回前台
              </Button>
            </Link>
          </Space>

          <Space size={16}>
            <Popover
              content={notificationPopoverContent}
              trigger="hover"
              placement="bottomRight"
              onOpenChange={handlePopoverOpenChange}
            >
              <Badge count={unreadCount} size="small" offset={[0, 2]}>
                <Button type="text" icon={<BellOutlined />} />
              </Badge>
            </Popover>

            <Dropdown
              menu={{ items: userMenuItems, onClick: ({ key }) => handleMenuClick(key) }}
              placement="bottomRight"
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" style={{ backgroundColor: token.colorPrimary }}>
                  {user?.name?.[0]?.toUpperCase() || 'A'}
                </Avatar>
                <span>{user?.name || '管理员'}</span>
                {user?.role === 'super' && (
                  <span style={{ fontSize: 12, color: token.colorPrimary }}>(超管)</span>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: 24,
            padding: 24,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>

      <Modal
        title={detailContent?.title || '通知详情'}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={
          <Button type="primary" onClick={() => setDetailModalOpen(false)}>
            关闭
          </Button>
        }
      >
        {detailContent && (
          <div>
            <Typography.Text type="secondary">
              {dayjs(detailContent.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Typography.Text>
            <pre
              style={{
                marginTop: 16,
                padding: 12,
                background: '#f5f5f5',
                borderRadius: 8,
                overflow: 'auto',
                maxHeight: 400,
              }}
            >
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(detailContent.content), null, 2)
                } catch {
                  return detailContent.content
                }
              })()}
            </pre>
          </div>
        )}
      </Modal>
    </Layout>
  )
}

export default AdminLayout
