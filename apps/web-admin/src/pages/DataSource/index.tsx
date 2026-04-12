/**
 * 数据源管理入口
 */
import React from 'react'
import { Card, Row, Col, Statistic, Badge, Button, Space } from 'antd'
import {
  DatabaseOutlined,
  CloudSyncOutlined,
  FileTextOutlined,
  BarChartOutlined,
  SyncOutlined,
  SettingOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const DataSource: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
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
        <Row gutter={[16, 16]}>
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
              onClick={() => navigate('/admin/datasource/settings')}
            >
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <ClockCircleOutlined style={{ fontSize: 32, color: '#faad14' }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>同步设置</div>
                  <div style={{ color: '#666' }}>配置新闻同步时间和数据源</div>
                </div>
                <Button type="primary" icon={<SettingOutlined />}>配置</Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default DataSource
