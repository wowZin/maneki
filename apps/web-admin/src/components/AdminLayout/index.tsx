import React, { useState, useEffect } from 'react'
import {
  Layout, Menu, Button, Avatar, Dropdown, Badge, Popover, List, Modal, Empty, Divider, Typography,
} from 'antd'
import {
  DashboardOutlined, UserOutlined, SettingOutlined, RobotOutlined, GiftOutlined,
  LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, BellOutlined,
  DatabaseOutlined, FileTextOutlined, TrophyOutlined, DollarOutlined, SafetyOutlined,
  BankOutlined, TeamOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
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

  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const notifications = useNotificationStore((s) => s.notifications)
  const fetchStats = useNotificationStore((s) => s.fetchStats)
  const fetchList = useNotificationStore((s) => s.fetchList)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)

  useEffect(() => {
    fetchStats()
    const interval = setInterval(() => fetchStats(), 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) fetchList({ page: 1, pageSize: 5 })
  }

  const handleClickNotification = async (item: any) => {
    if (!item.is_read) await markRead(item.id)
    setDetailContent({ title: item.title, content: item.content, created_at: item.created_at })
    setDetailModalOpen(true)
  }

  const notificationPopoverContent = (
    <div className="w-[360px]">
      <div className="flex items-center justify-between mb-2">
        <Typography.Text strong>通知中心</Typography.Text>
        {unreadCount > 0 && (
          <Button type="link" size="small" onClick={markAllRead}>全部已读</Button>
        )}
      </div>
      <Divider className="!my-2" />
      {notifications.length === 0 ? (
        <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={notifications}
          renderItem={(item: any) => (
            <List.Item
              className={`cursor-pointer rounded-md px-3 py-2 ${item.is_read ? 'bg-transparent' : 'bg-[#f0f7ff]'}`}
              onClick={() => handleClickNotification(item)}
            >
              <List.Item.Meta
                avatar={
                  item.type === 'task_failed'
                    ? <ExclamationCircleOutlined className="text-[#ff4d4f] text-base" />
                    : <CheckCircleOutlined className="text-[#52c41a] text-base" />
                }
                title={
                  <div className="flex items-center gap-2">
                    <Typography.Text ellipsis className="max-w-[220px]" style={{ fontWeight: item.is_read ? 'normal' : 'bold' }}>
                      {item.title}
                    </Typography.Text>
                    {!item.is_read && <Badge status="processing" />}
                  </div>
                }
                description={
                  <Typography.Text type="secondary" className="text-xs">{dayjs(item.created_at).fromNow()}</Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      )}
      <Divider className="!my-2" />
      <Button type="link" block onClick={() => navigate('/notifications')}>查看全部通知</Button>
    </div>
  )

  const baseMenuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '概览' },
    { key: '/users', icon: <UserOutlined />, label: '用户管理' },
    { key: '/agents', icon: <RobotOutlined />, label: 'Agent 管理' },
    {
      key: 'rebates', icon: <GiftOutlined />, label: '返佣管理',
      children: [
        { key: '/rebates', icon: <DollarOutlined />, label: '返佣统计' },
        { key: '/rebates/records', icon: <FileTextOutlined />, label: '返佣记录' },
        { key: '/rebates/rules', icon: <SettingOutlined />, label: '规则设置' },
        { key: '/rebates/anti-arbitrage', icon: <SafetyOutlined />, label: '防套利规则' },
      ],
    },
    {
      key: 'datasource', icon: <DatabaseOutlined />, label: '数据源管理',
      children: [
        { key: '/datasource/news', icon: <FileTextOutlined />, label: '新闻资讯' },
        { key: '/datasource/top-list', icon: <TrophyOutlined />, label: '龙虎榜数据' },
        { key: '/datasource/top-inst', icon: <BankOutlined />, label: '龙虎榜机构交易名单' },
        { key: '/datasource/hot-money', icon: <TeamOutlined />, label: '游资名录' },
      ],
    },
    {
      key: 'settings', icon: <SettingOutlined />, label: '系统设置',
      children: [
        { key: '/settings/pricing', icon: <DollarOutlined />, label: '定价设置' },
        { key: '/settings/notification', icon: <BellOutlined />, label: '通知设置' },
        { key: '/settings/system', icon: <SettingOutlined />, label: '元信息配置' },
      ],
    },
  ]

  const superMenuItems = [
    { key: '/admin-settings', icon: <SafetyOutlined />, label: '管理员设置' },
  ]

  const menuItems = user?.role === 'super' ? [...baseMenuItems, ...superMenuItems] : baseMenuItems

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: '个人资料' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ]

  const handleMenuClick = (key: string) => {
    if (key === 'logout') { logout(); navigate('/login') }
    else if (key === 'profile') navigate('/profile')
    else navigate(key)
  }

  const siderWidth = collapsed ? 72 : 240

  return (
    <Layout className="h-screen overflow-hidden">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        className="!bg-white border-r border-[var(--color-border)] shadow-[2px_0_8px_rgba(15,23,42,0.03)] z-10 !fixed left-0 top-0 bottom-0"
        width={siderWidth}
        collapsedWidth={72}
        style={{ overflow: 'auto' }}
      >
        <div
          className="h-16 flex items-center justify-start pl-2 gap-3 border-b border-[var(--color-border-light)] cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors"
          onClick={() => navigate('/')}
        >
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center text-white text-base shrink-0">
            <RobotOutlined />
          </div>
          {!collapsed && <span className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">管理后台</span>}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems as any}
          onClick={({ key }) => handleMenuClick(key)}
          className="!border-r-0 mt-2"
          style={{ background: 'transparent' }}
        />
      </Sider>

      <Layout className="h-screen overflow-hidden" style={{ marginLeft: siderWidth, transition: 'margin-left 0.2s' }}>
        <Header className="!bg-white !px-6 flex items-center justify-between border-b border-[var(--color-border)] shadow-[0_1px_4px_rgba(15,23,42,0.03)] h-16 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
          </div>

          <div className="flex items-center gap-4">
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
              menu={{ items: userMenuItems as any, onClick: ({ key }) => handleMenuClick(key as string) }}
              placement="bottomRight"
            >
              <div className="flex items-center gap-2 cursor-pointer">
                <Avatar size="small" className="!bg-[var(--color-primary)]">
                  {user?.name?.[0]?.toUpperCase() || 'A'}
                </Avatar>
                <span className="text-sm text-[var(--color-text-primary)]">{user?.name || '管理员'}</span>
                {user?.role === 'super' && <span className="text-xs text-[var(--color-primary)]">(超管)</span>}
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="bg-[var(--color-bg-body)] overflow-auto" style={{ height: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>

      <Modal
        title={detailContent?.title || '通知详情'}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={<Button type="primary" onClick={() => setDetailModalOpen(false)}>关闭</Button>}
      >
        {detailContent && (
          <div>
            <Typography.Text type="secondary">{dayjs(detailContent.created_at).format('YYYY-MM-DD HH:mm:ss')}</Typography.Text>
            <pre className="mt-4 p-3 bg-[var(--color-bg-subtle)] rounded-lg overflow-auto max-h-[400px] text-sm">
              {(() => {
                try { return JSON.stringify(JSON.parse(detailContent.content), null, 2) }
                catch { return detailContent.content }
              })()}
            </pre>
          </div>
        )}
      </Modal>
    </Layout>
  )
}

export default AdminLayout
