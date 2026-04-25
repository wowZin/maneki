/**
 * 用户订阅状态摘要栏
 */

import React, { useEffect } from 'react'
import { Avatar, Button, Tag } from 'antd'
import { UserOutlined, CrownOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useUserProfileStore } from '../../stores/userProfile'
import { useAuthStore } from '../../stores/auth'
import styles from './UserStatusBar.module.css'

interface UserStatusBarProps {
  onUpgrade?: () => void
}

const UserStatusBar: React.FC<UserStatusBarProps> = ({ onUpgrade }) => {
  const { user } = useAuthStore()
  const { profile, fetchProfile } = useUserProfileStore()

  useEffect(() => {
    if (user && !profile) {
      fetchProfile()
    }
  }, [user, profile, fetchProfile])

  if (!user) return null

  const isVip = (profile?.vip_level ?? 0) >= 1
  const isExpired = profile?.vip_expire_at
    ? new Date(profile.vip_expire_at) < new Date()
    : false

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <Avatar
          icon={<UserOutlined />}
          src={profile?.avatar_url || user?.avatar_url}
          style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
        />
        <div className={styles.info}>
          <div className={styles.nameRow}>
            <span className={styles.name}>{profile?.nickname || user?.username || '用户'}</span>
            {isVip && !isExpired ? (
              <Tag
                icon={<CrownOutlined />}
                color={profile?.vip_level_color || 'gold'}
                style={{ fontWeight: 600 }}
              >
                {profile?.vip_level_name || 'VIP'}
              </Tag>
            ) : (
              <Tag icon={<ClockCircleOutlined />} style={{ fontWeight: 500 }}>
                免费体验
              </Tag>
            )}
          </div>
          {profile?.vip_expire_at && !isExpired && (
            <span className={styles.expiry}>
              有效期至 {new Date(profile.vip_expire_at).toLocaleDateString()}
            </span>
          )}
          {isExpired && (
            <span className={styles.expired}>
              会员已过期，续费恢复全部权益
            </span>
          )}
        </div>
      </div>

      {(!isVip || isExpired) && (
        <Button
          type="primary"
          className={styles.upgradeBtn}
          onClick={onUpgrade}
        >
          立即升级
        </Button>
      )}
    </div>
  )
}

export default UserStatusBar