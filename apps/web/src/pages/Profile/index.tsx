/**
 * 个人信息页面
 */

import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Tag, Button, Skeleton } from 'antd'
import {
  EditOutlined,
  LockOutlined,
  PhoneOutlined,
  CrownOutlined,
  UserOutlined,
  CalendarOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useUserProfileStore } from '../../stores/userProfile'
import AvatarUpload from './AvatarUpload'
import EditNickname from './EditNickname'
import ChangePassword from './ChangePassword'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const Profile: React.FC = () => {
  const { profile, rebate, isLoading, isRebateLoading, fetchProfile, fetchRebate } = useUserProfileStore()
  const [editNicknameOpen, setEditNicknameOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  useEffect(() => {
    fetchProfile().then(() => {
      fetchRebate()
    })
  }, [fetchProfile, fetchRebate])

  const getVipTagColor = (level: number) => {
    switch (level) {
      case 2:
        return 'gold'
      case 1:
        return 'blue'
      default:
        return 'default'
    }
  }

  const getVipTagText = (level: number) => {
    switch (level) {
      case 2:
        return 'SVIP'
      case 1:
        return 'VIP'
      default:
        return '普通用户'
    }
  }

  const avatarUrl = profile?.avatar_url
    ? profile.avatar_url.startsWith('http')
      ? profile.avatar_url
      : `${API_BASE_URL}${profile.avatar_url}`
    : undefined

  return (
    <div>
      {/* 页面标题 */}
      <div className="page-header">
        <h1 className="page-title">个人中心</h1>
        <p className="page-subtitle">管理您的账户信息与安全设置</p>
      </div>

      {isLoading && !profile ? (
        <Card className="glass-card" style={{ padding: 32 }}>
          <Skeleton avatar paragraph={{ rows: 4 }} active />
        </Card>
      ) : (
        <Row gutter={[24, 24]}>
          {/* 左侧：个人信息卡片 */}
          <Col xs={24} lg={16}>
            <Card
              className="glass-card"
              style={{ borderRadius: 'var(--radius-xl)' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 32 }}>
                <AvatarUpload avatarUrl={avatarUrl} nickname={profile?.nickname} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {profile?.nickname || '未设置昵称'}
                    </h2>
                    <Tag color={getVipTagColor(profile?.vip_level || 0)} style={{ fontWeight: 600 }}>
                      <CrownOutlined style={{ marginRight: 4 }} />
                      {profile?.vip_level_name || getVipTagText(profile?.vip_level || 0)}
                    </Tag>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
                    用户ID: {profile?.id}
                  </p>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-light)', margin: '24px 0' }} />

              {/* 信息列表 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 账户名称 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, var(--primary-100), var(--primary-200))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary-600)',
                        fontSize: 18,
                      }}
                    >
                      <UserOutlined />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>账户名称</div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {profile?.nickname || '未设置'}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => setEditNicknameOpen(true)}
                    style={{ color: 'var(--primary-500)' }}
                  >
                    修改
                  </Button>
                </div>

                {/* 手机号 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(6, 182, 212, 0.25))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--cyan-600)',
                        fontSize: 18,
                      }}
                    >
                      <PhoneOutlined />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>手机号</div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {profile?.phone || '未绑定'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 用户等级 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, rgba(250, 173, 20, 0.15), rgba(250, 173, 20, 0.25))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#d48806',
                        fontSize: 18,
                      }}
                    >
                      <CrownOutlined />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>用户等级</div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
                        <Tag color={getVipTagColor(profile?.vip_level || 0)}>
                          {profile?.vip_level_name || getVipTagText(profile?.vip_level || 0)}
                        </Tag>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 注册时间 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.25))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--emerald-600)',
                        fontSize: 18,
                      }}
                    >
                      <CalendarOutlined />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>注册时间</div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {profile?.created_at || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-light)', margin: '24px 0' }} />

              {/* 安全设置 */}
              <div>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                  安全设置
                </h3>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(59, 130, 246, 0.04)',
                    border: '1px solid rgba(59, 130, 246, 0.1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <LockOutlined style={{ fontSize: 20, color: 'var(--primary-500)' }} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>登录密码</div>
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>定期修改密码可保护账户安全</div>
                    </div>
                  </div>
                  <Button type="primary" onClick={() => setChangePasswordOpen(true)}>
                    修改密码
                  </Button>
                </div>
              </div>
            </Card>
          </Col>

          {/* 右侧：返佣卡片（仅 SVIP） */}
          {profile?.vip_level === 2 && (
            <Col xs={24} lg={8}>
              <Card
                className="glass-card"
                style={{
                  borderRadius: 'var(--radius-xl)',
                  background: 'linear-gradient(135deg, rgba(255, 251, 235, 0.9), rgba(255, 245, 220, 0.85))',
                  border: '1px solid rgba(250, 173, 20, 0.2)',
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #faad14, #ffc53d)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                      boxShadow: '0 8px 24px rgba(250, 173, 20, 0.3)',
                    }}
                  >
                    <WalletOutlined style={{ fontSize: 28, color: '#fff' }} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#d48806' }}>
                    返佣收益
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
                    SVIP 专属权益
                  </p>
                </div>

                {isRebateLoading ? (
                  <Skeleton active paragraph={{ rows: 2 }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div
                      style={{
                        padding: '16px 20px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.7)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                        累计返佣
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: '#d48806' }}>
                        {rebate?.currency || '¥'}{rebate?.total_rebate.toFixed(2) || '0.00'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <div
                        style={{
                          flex: 1,
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(255, 255, 255, 0.7)',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                          待结算
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {rebate?.currency || '¥'}{rebate?.pending_rebate.toFixed(2) || '0.00'}
                        </div>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(255, 255, 255, 0.7)',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                          已结算
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {rebate?.currency || '¥'}{rebate?.settled_rebate.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </Col>
          )}
        </Row>
      )}

      {/* Modals */}
      <EditNickname
        open={editNicknameOpen}
        currentNickname={profile?.nickname || ''}
        onClose={() => setEditNicknameOpen(false)}
      />
      <ChangePassword
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  )
}

export default Profile
