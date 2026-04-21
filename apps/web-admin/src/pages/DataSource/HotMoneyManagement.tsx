/**
 * 游资名录数据管理页面
 */
import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Input,
  Button,
  Space,
  Tag,
  Popconfirm,
  message,
  Row,
  Col,
  Tooltip,
  Statistic,
  Modal,
  Form,
  TimePicker,
  Divider,
  Switch,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  TeamOutlined,
  EyeOutlined,
  SettingOutlined,
  PlusOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { hotMoneyApi } from '../../services/hotmoney'
import type { ColumnsType } from 'antd/es/table'

interface HotMoneyItem {
  id: string
  name: string
  description: string
  organizations: string
  source: string
}

interface HotMoneyStats {
  total: number
}

const HotMoneyManagement: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<HotMoneyItem[]>([])
  const [stats, setStats] = useState<HotMoneyStats>({ total: 0 })
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })

  // 设置弹窗
  const [settingsModalVisible, setSettingsModalVisible] = useState(false)
  const [settingsForm] = Form.useForm()
  const [settingsLoading, setSettingsLoading] = useState(false)

  // 查询参数
  const [searchName, setSearchName] = useState('')

  // 获取统计
  const fetchStats = async () => {
    try {
      const result = await hotMoneyApi.getStats()
      if (result.code === 0) {
        setStats(result.data)
      }
    } catch (error) {
      // 忽略统计错误
    }
  }

  // 获取游资名录列表
  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const params: any = { page, pageSize }
      if (searchName) {
        params.name = searchName
      }

      const result = await hotMoneyApi.getHotMoneyList(params)
      setData(result.data || [])
      setPagination({
        current: result.page || page,
        pageSize: result.pageSize || pageSize,
        total: result.total || 0,
      })
    } catch (error) {
      message.error('获取游资名录数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchStats()
  }, [])

  // 手动同步游资名录数据
  const handleSync = async () => {
    setLoading(true)
    try {
      const result = await hotMoneyApi.syncHotMoney()
      if (result.code === 0) {
        message.success('同步成功，正在刷新数据...')
        await fetchData(pagination.current, pagination.pageSize)
        await fetchStats()
      } else {
        message.error(result.message || '同步失败')
      }
    } catch (error) {
      message.error('同步请求失败')
    } finally {
      setLoading(false)
    }
  }

  // 删除单条数据
  const handleDelete = async (id: string) => {
    try {
      await hotMoneyApi.deleteHotMoney(id)
      message.success('删除成功')
      fetchData(pagination.current, pagination.pageSize)
      fetchStats()
    } catch (error) {
      message.error('删除失败')
    }
  }

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的数据')
      return
    }
    try {
      await hotMoneyApi.batchDeleteHotMoney(selectedRowKeys as string[])
      message.success(`成功删除 ${selectedRowKeys.length} 条数据`)
      setSelectedRowKeys([])
      fetchData(pagination.current, pagination.pageSize)
      fetchStats()
    } catch (error) {
      message.error('批量删除失败')
    }
  }

  // 打开设置弹窗
  const handleOpenSettings = async () => {
    setSettingsModalVisible(true)
    setSettingsLoading(true)
    try {
      const result = await hotMoneyApi.getSyncSettings()
      if (result.data) {
        const fixedTimes = (result.data.fixed_times || ['06:00']).map((t: string) =>
          dayjs(t, 'HH:mm')
        )
        settingsForm.setFieldsValue({
          enabled: result.data.enabled !== false,
          fixed_times: fixedTimes,
        })
      }
    } catch (error) {
      settingsForm.setFieldsValue({
        enabled: true,
        fixed_times: [dayjs('06:00', 'HH:mm')],
      })
    } finally {
      setSettingsLoading(false)
    }
  }

  // 保存设置
  const handleSaveSettings = async (values: any) => {
    try {
      const fixedTimes = values.fixed_times
        .filter((t: any) => t)
        .map((t: any) => t.format('HH:mm'))

      await hotMoneyApi.saveSyncSettings({
        enabled: values.enabled,
        fixed_times: fixedTimes,
      })
      message.success('设置保存成功')
      setSettingsModalVisible(false)
    } catch (error) {
      message.error('保存设置失败')
    }
  }

  // 解析关联机构为 Tag 列表
  const renderOrganizations = (orgsJson: string) => {
    if (!orgsJson) return '-'
    try {
      const orgs = JSON.parse(orgsJson)
      if (Array.isArray(orgs) && orgs.length > 0) {
        return (
          <Space size={[0, 4]} wrap>
            {orgs.slice(0, 5).map((org: string, idx: number) => (
              <Tag key={idx} color="blue">
                {org}
              </Tag>
            ))}
            {orgs.length > 5 && <Tag>+{orgs.length - 5}</Tag>}
          </Space>
        )
      }
    } catch {
      // 非 JSON 则原样显示
    }
    return <span>{orgsJson}</span>
  }

  // 表格列定义
  const columns: ColumnsType<HotMoneyItem> = [
    {
      title: '游资名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '关联机构',
      dataIndex: 'organizations',
      key: 'organizations',
      width: 280,
      render: (text: string) => renderOrganizations(text),
    },
    {
      title: '数据来源',
      dataIndex: 'source',
      key: 'source',
      width: 120,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_: any, record: HotMoneyItem) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                Modal.info({
                  title: record.name,
                  content: (
                    <div style={{ marginTop: 16 }}>
                      <p><strong>描述：</strong>{record.description || '-'}</p>
                      <p><strong>关联机构：</strong></p>
                      <div>{renderOrganizations(record.organizations)}</div>
                    </div>
                  ),
                  width: 600,
                })
              }}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="确定要删除这条游资名录数据吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 表格行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  }

  // 分页配置
  const handleTableChange = (newPagination: any) => {
    fetchData(newPagination.current, newPagination.pageSize)
  }

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={12}>
          <Card>
            <Statistic
              title="游资名录总数"
              value={stats.total}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={12}>
          <Card>
            <Statistic
              title="数据来源"
              value="Tushare"
              prefix={<ReloadOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <TeamOutlined />
            <span>游资名录管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<SettingOutlined />} onClick={handleOpenSettings}>
              同步设置
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleSync} loading={loading}>
              同步数据
            </Button>
          </Space>
        }
      >
        {/* 查询条件 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="搜索游资名称"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              prefix={<SearchOutlined />}
              allowClear
              onPressEnter={() => fetchData(1, pagination.pageSize)}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space>
              <Button type="primary" onClick={() => fetchData(1, pagination.pageSize)}>
                查询
              </Button>
              <Button
                onClick={() => {
                  setSearchName('')
                  fetchData(1, pagination.pageSize)
                }}
              >
                重置
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 批量操作 */}
        {selectedRowKeys.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Popconfirm
              title="确认批量删除"
              description={`确定要删除选中的 ${selectedRowKeys.length} 条数据吗？`}
              onConfirm={handleBatchDelete}
              okText="确认"
              cancelText="取消"
            >
              <Button type="primary" danger icon={<DeleteOutlined />}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          </div>
        )}

        {/* 数据表格 */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={handleTableChange}
          rowSelection={rowSelection}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 同步设置弹窗 */}
      <Modal
        title="游资名录同步设置"
        open={settingsModalVisible}
        onOk={settingsForm.submit}
        onCancel={() => setSettingsModalVisible(false)}
        confirmLoading={settingsLoading}
        width={600}
      >
        <Form
          form={settingsForm}
          layout="vertical"
          onFinish={handleSaveSettings}
        >
          <Form.Item
            name="enabled"
            label="启用自动同步"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="固定获取时间"
            required
            tooltip="设置每天自动获取游资名录数据的时间点"
          >
            <Form.List name="fixed_times">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space key={field.key} align="baseline">
                      <Form.Item
                        {...field}
                        validateTrigger={['onChange', 'onBlur']}
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            message: '请选择时间',
                          },
                        ]}
                        noStyle
                      >
                        <TimePicker
                          format="HH:mm"
                          placeholder="选择时间"
                        />
                      </Form.Item>
                      {fields.length > 1 && (
                        <MinusCircleOutlined
                          onClick={() => remove(field.name)}
                        />
                      )}
                    </Space>
                  ))}
                  <Form.Item>
                    <Button
                      type="dashed"
                      onClick={() => add()}
                      icon={<PlusOutlined />}
                    >
                      添加时间
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
          <div style={{ color: '#999', fontSize: 12 }}>
            <Divider />
            <p>提示：</p>
            <ul>
              <li>系统将在设定的时间点自动从 Tushare 获取游资名录数据</li>
              <li>建议设置为早盘前的时间，如 06:00</li>
              <li>可以设置多个时间点作为备份</li>
            </ul>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default HotMoneyManagement
