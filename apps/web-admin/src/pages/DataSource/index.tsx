/**
 * 数据源管理入口
 */
import React from 'react'
import { Card, Row, Col, Statistic, Badge, Space } from 'antd'
import {
  DatabaseOutlined,
  FileTextOutlined,
  BarChartOutlined,
  TrophyOutlined,
  BankOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const DataSource: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="新闻总数"
              value={1234}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="今日新增"
              value={56}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="K线记录"
              value={12345678}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="数据源状态"
              value="正常"
              prefix={<Badge status="success" />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <DatabaseOutlined />
            <span>数据源管理</span>
          </Space>
        }
      >
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8}>
            <Card
              hoverable
              onClick={() => navigate('/admin/datasource/news')}
            >
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <FileTextOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>新闻资讯</div>
                  <div style={{ color: '#666' }}>管理财经新闻、查询和删除操作</div>
                </div>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card
              hoverable
              onClick={() => navigate('/admin/datasource/top-list')}
            >
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <TrophyOutlined style={{ fontSize: 32, color: '#fa541c' }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>龙虎榜数据</div>
                  <div style={{ color: '#666' }}>管理龙虎榜数据、查看交易明细</div>
                </div>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card
              hoverable
              onClick={() => navigate('/admin/datasource/top-inst')}
            >
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <BankOutlined style={{ fontSize: 32, color: '#722ed1' }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>龙虎榜机构交易名单</div>
                  <div style={{ color: '#666' }}>管理龙虎榜机构交易名单数据</div>
                </div>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card
              hoverable
              onClick={() => navigate('/admin/datasource/hot-money')}
            >
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <TeamOutlined style={{ fontSize: 32, color: '#13c2c2' }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>游资名录</div>
                  <div style={{ color: '#666' }}>管理游资信息、关联机构数据</div>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default DataSource
