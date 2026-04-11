/**
 * 仪表盘首页 - 科技感主题
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Typography, Button, Space, Badge } from 'antd'
import {
  StockOutlined,
  AlertOutlined,
  RiseOutlined,
  FallOutlined,
  CrownOutlined,
  ThunderboltOutlined,
  TrendingUpOutlined,
  BarChartOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

// 统计卡片组件
interface StatCardProps {
  icon: React.ReactNode
  iconClass: string
  value: string | number
  label: string
  trend?: string
  trendUp?: boolean
}

const StatCard: React.FC<StatCardProps> = ({ icon, iconClass, value, label, trend, trendUp }) => (
  <div className="stat-card">
    <div className={`stat-icon ${iconClass}`}>{icon}</div>
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
    {trend && (
      <div style={{
        marginTop: 8,
        fontSize: 13,
        color: trendUp ? 'var(--emerald-500)' : '#ef4444',
        fontWeight: 500
      }}>
        {trendUp ? '↑' : '↓'} {trend}
      </div>
    )}
  </div>
)

const Dashboard: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div>
      {/* 页面标题 */}
      <div className="page-header">
        <h1 className="page-title">仪表盘</h1>
        <p className="page-subtitle">实时监控您的股票信号与分析数据</p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<StockOutlined />}
            iconClass="stat-icon-blue"
            value="128"
            label="监控股票"
            trend="12%"
            trendUp={true}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<AlertOutlined />}
            iconClass="stat-icon-cyan"
            value="24"
            label="今日信号"
            trend="5 新信号"
            trendUp={true}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<RiseOutlined />}
            iconClass="stat-icon-green"
            value="8"
            label="涨停预测"
            trend="85% 准确率"
            trendUp={true}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<FallOutlined />}
            iconClass="stat-icon-red"
            value="3"
            label="风险预警"
            trend="需关注"
            trendUp={false}
          />
        </Col>
      </Row>

      {/* 升级会员推广卡片 */}
      <div className="promo-card" style={{ marginBottom: 32 }}>
        <div className="promo-card-content">
          <Row align="middle" justify="space-between">
            <Col xs={24} md={16}>
              <Space align="center" size="middle">
                <div style={{
                  width: 60,
                  height: 60,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28
                }}
                >
                  <CrownOutlined />
                </div>
                <div>
                  <h2 className="promo-title">升级专业版</h2>
                  <p className="promo-text">
                    解锁 Level-2 行情数据、AI 智能信号、涨停预测算法等高级功能
                  </p>
                </div>
              </Space>
            </Col>
            <Col xs={24} md={8} style={{ textAlign: 'right', marginTop: { xs: 16, md: 0 } }}>
              <Button
                className="promo-button"
                icon={<ThunderboltOutlined />}
                onClick={() => navigate('/pricing')}
              >
                立即升级
              </Button>
            </Col>
          </Row>
        </div>
      </div>

      {/* 数据展示区域 */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#3b82f6' }} />
                <span>实时信号</span>
                <Badge count="5" style={{ backgroundColor: '#3b82f6' }} />
              </Space>
            }
            className="glass-card"
            style={{ borderRadius: 16 }}
          >
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(6,182,212,0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 36,
                color: 'var(--primary-400)'
              }}
              >
                <AlertOutlined />
              </div>
              <Text style={{ color: 'var(--text-secondary)' }}>暂无新的交易信号</Text>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>
                系统正在实时监控市场数据...
              </p>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <TrendingUpOutlined style={{ color: '#10b981' }} />
                <span>热门股票</span>
              </Space>
            }
            className="glass-card"
            style={{ borderRadius: 16 }}
          >
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 36,
                color: 'var(--emerald-500)'
              }}
              >
                <BarChartOutlined />
              </div>
              <Text style={{ color: 'var(--text-secondary)' }}>暂无热门股票数据</Text>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>
                升级会员查看实时热门榜单
              </p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
