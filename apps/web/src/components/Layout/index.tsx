/**
 * 主布局组件 - 科技感主题
 */

import React from 'react'
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom'
import {
  Layout as AntLayout,
  Menu,
  Avatar,
  Dropdown,
  Space,
  Typography,
  Button,
} from 'antd'
import {
  StockOutlined,
  DashboardOutlined,
  AlertOutlined,
  HistoryOutlined,
  CrownOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuUnfoldOutlined,
  ShopOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../stores/auth'

const { Header, Content, Sider } = AntLayout
const { Text } = Typography

const Layout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)

  // 检测移动端
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 992)
      if (window.innerWidth <= 992) {
        setCollapsed(true)
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
    {
      type: 'divider' as const,
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
      handleLogout()
    } else if (key === 'profile') {
      navigate('/profile')
    } else if (key === 'settings') {
      navigate('/settings')
    }
  }

  // 侧边栏菜单
  const siderMenuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">仪表盘</Link>,
    },
    {
      key: '/stocks',
      icon: <StockOutlined />,
      label: <Link to="/stocks">股票监控</Link>,
    },
    {
      key: '/marketplace',
      icon: <ShopOutlined />,
      label: <Link to="/marketplace">Agent 市场</Link>,
    },
    {
      key: '/signals',
      icon: <AlertOutlined />,
      label: <Link to="/signals">信号中心</Link>,
    },
    {
      key: '/replay',
      icon: <HistoryOutlined />,
      label: <Link to="/replay">回测分析</Link>,
    },
    {
      key: '/pricing',
      icon: <CrownOutlined style={{ color: '#f59e0b' }} />,
      label: <Link to="/pricing">升级会员</Link>,
    },
  ]

  return (
    <AntLayout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* 科技背景效果 */}
      <div className="tech-bg-grid" />
      <div className="tech-bg-glow">
        <div className="tech-glow-1" />
        <div className="tech-glow-2" />
        <div className="tech-glow-3" />
      </div>

      {/* 移动端遮罩 */}
      {isMobile && mobileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99,
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sider
        theme="light"
        breakpoint="lg"
        collapsedWidth={isMobile ? 0 : 80}
        width={260}
        className="tech-sider"
        trigger={null}
        collapsible
        collapsed={isMobile ? !mobileOpen : collapsed}
        onCollapse={(collapsed) => {
          if (isMobile) {
            setMobileOpen(!collapsed)
          } else {
            setCollapsed(collapsed)
          }
        }}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          height: '100vh',
          zIndex: 100,
        }}
      >
        <div className="tech-logo">
          <div className="tech-logo-icon">
            <StockOutlined />
          </div>
          <span className="tech-logo-text">Maneki</span>
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={siderMenuItems}
          className="tech-menu"
          style={{ background: 'transparent' }}
        />
      </Sider>

      <AntLayout
        style={{
          marginLeft: isMobile ? 0 : (collapsed ? 80 : 260),
          background: 'transparent',
          position: 'relative',
          zIndex: 1,
          transition: 'margin-left 0.3s ease'
        }}
      >
        <Header
          className="tech-header"
          style={{
            padding: isMobile ? '0 16px' : '0 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* 移动端菜单按钮 */}
          {isMobile && (
            <Button
              type="text"
              icon={<MenuUnfoldOutlined style={{ fontSize: 20, color: 'var(--text-primary)' }} />}
              onClick={() => setMobileOpen(true)}
              style={{ padding: 8 }}
            />
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%', flex: 1 }}>
            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: ({ key }) => handleMenuClick(key),
              }}
              placement="bottomRight"
            >
              <Space className="tech-user-info">
                <Avatar
                  icon={<UserOutlined />}
                  src={user?.avatar_url}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                  }}
                />
                <Text style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {user?.username || '用户'}
                </Text>
              </Space>
            </Dropdown>
          </div>
        </Header>

        <Content className="tech-content">
          <div className="tech-content-inner">
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
