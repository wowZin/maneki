/**
 * 个人中心页面
 * 暖色招财风格，展示用户信息与会员状态
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Avatar,
  Button,
  Form,
  Input,
  message,
  Tag,
  Skeleton,
} from 'antd'
import {
  UserOutlined,
  CrownOutlined,
  EditOutlined,
  SaveOutlined,
  MobileOutlined,
  SafetyCertificateOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../stores/auth'
import { pricingApi, UserMembership } from '../../services/pricing'
import styles from './Profile.module.css'

const Profile: React.FC = () => {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  const [form] = Form.useForm()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [membership, setMembership] = useState<UserMembership | null>(null)
  const [loadingMembership, setLoadingMembership] = useState(true)

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        nickname: user.nickname,
        phone: user.phone,
      })
    }
    fetchMembership()
  }, [user, form])

  const fetchMembership = async () => {
    try {
      setLoadingMembership(true)
      const data = await pricingApi.getUserMembership()
      setMembership(data)
    } catch {
      // 静默失败
    } finally {
      setLoadingMembership(false)
    }
  }

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      // TODO: 调用更新用户信息的 API
      // await authApi.updateProfile(values)
      setUser({ ...user!, ...values })
      message.success('个人信息已更新')
      setEditing(false)
    } catch {
      message.error('更新失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'svip': return { color: '#9b59b6', bg: 'rgba(155, 89, 182, 0.1)', label: 'SVIP' }
      case 'vip': return { color: '#f39c12', bg: 'rgba(243, 156, 18, 0.1)', label: 'VIP' }
      default: return { color: '#7a7a7a', bg: 'rgba(0,0,0,0.04)', label: '免费版' }
    }
  }

  const tierInfo = getTierColor(membership?.tier)

  return (
    <div className={styles.profilePage}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>个人中心</h1>
        <p className={styles.pageSubtitle}>管理您的账号信息与会员状态</p>
      </div>

      <div className={styles.grid}>
        {/* 左侧：用户信息卡片 */}
        <div className={styles.leftCol}>
          <Card className={styles.userCard} bordered={false}>
            <div className={styles.userHeader}>
              <div className={styles.avatarWrap}>
                <Avatar
                  size={96}
                  icon={<UserOutlined />}
                  src={user?.avatar_url}
                  className={styles.avatar}
                />
                <div className={styles.avatarRing} />
              </div>
              <h2 className={styles.userName}>{user?.nickname || '用户'}</h2>
              <p className={styles.userHandle}>@{user?.nickname}</p>
              <Tag
                className={styles.tierTag}
                style={{
                  color: tierInfo.color,
                  background: tierInfo.bg,
                  borderColor: tierInfo.color,
                }}
              >
                <CrownOutlined /> {tierInfo.label}
              </Tag>
            </div>

            <div className={styles.userMeta}>
              <div className={styles.metaItem}>
                <MobileOutlined className={styles.metaIcon} />
                <div>
                  <div className={styles.metaLabel}>手机号</div>
                  <div className={styles.metaValue}>{user?.phone || '-'}</div>
                </div>
              </div>
              <div className={styles.metaItem}>
                <MobileOutlined className={styles.metaIcon} />
                <div>
                  <div className={styles.metaLabel}>手机号</div>
                  <div className={styles.metaValue}>{user?.phone || '未绑定'}</div>
                </div>
              </div>
              <div className={styles.metaItem}>
                <SafetyCertificateOutlined className={styles.metaIcon} />
                <div>
                  <div className={styles.metaLabel}>账号状态</div>
                  <div className={styles.metaValue}>
                    {user?.is_verified ? (
                      <span style={{ color: '#27ae60' }}>已认证</span>
                    ) : (
                      <span style={{ color: '#e67e22' }}>未认证</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* 会员信息卡片 */}
          <Card className={styles.membershipCard} bordered={false} loading={loadingMembership}>
            <div className={styles.cardHeader}>
              <CrownOutlined className={styles.cardIcon} />
              <span>会员信息</span>
            </div>
            {membership ? (
              <div className={styles.membershipBody}>
                <div className={styles.membershipRow}>
                  <span className={styles.membershipLabel}>当前等级</span>
                  <Tag color={membership.tier === 'svip' ? 'purple' : membership.tier === 'vip' ? 'orange' : 'default'}>
                    {membership.tier.toUpperCase()}
                  </Tag>
                </div>
                <div className={styles.membershipRow}>
                  <span className={styles.membershipLabel}>有效期至</span>
                  <span className={styles.membershipValue}>
                    {new Date(membership.end_date).toLocaleDateString()}
                  </span>
                </div>
                <div className={styles.membershipRow}>
                  <span className={styles.membershipLabel}>自动续费</span>
                  <span className={styles.membershipValue}>
                    {membership.auto_renew ? '已开启' : '未开启'}
                  </span>
                </div>
                <Button
                  type="primary"
                  block
                  icon={<CrownOutlined />}
                  className={styles.upgradeBtn}
                  onClick={() => navigate('/pricing')}
                >
                  升级会员
                </Button>
              </div>
            ) : (
              <div className={styles.membershipEmpty}>
                <BarChartOutlined style={{ fontSize: 40, color: '#d0c0b0' }} />
                <p>暂无会员信息</p>
                <Button
                  type="primary"
                  className={styles.upgradeBtn}
                  onClick={() => navigate('/pricing')}
                >
                  立即升级
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* 右侧：编辑表单 */}
        <div className={styles.rightCol}>
          <Card
            className={styles.editCard}
            bordered={false}
            title={
              <div className={styles.cardTitleRow}>
                <span>个人资料</span>
                {!editing && (
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => setEditing(true)}
                    className={styles.editBtn}
                  >
                    编辑
                  </Button>
                )}
              </div>
            }
          >
            {user ? (
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                disabled={!editing}
                className={styles.profileForm}
              >
                <Form.Item
                  name="nickname"
                  label="昵称"
                  rules={[{ required: true, message: '请输入昵称' }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="昵称" />
                </Form.Item>

                <Form.Item
                  name="phone"
                  label="手机号"
                >
                  <Input prefix={<MobileOutlined />} placeholder="手机号" maxLength={11} />
                </Form.Item>

                {editing && (
                  <div className={styles.formActions}>
                    <Button
                      onClick={() => {
                        setEditing(false)
                        form.resetFields()
                      }}
                      className={styles.cancelBtn}
                    >
                      取消
                    </Button>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={saving}
                      icon={<SaveOutlined />}
                      className={styles.saveBtn}
                    >
                      保存修改
                    </Button>
                  </div>
                )}
              </Form>
            ) : (
              <Skeleton active paragraph={{ rows: 4 }} />
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Profile
