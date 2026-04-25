/**
 * 设置页面
 * 暖色招财风格，账号安全与偏好设置
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  message,
  Divider,
} from 'antd'
import {
  LockOutlined,
  SafetyOutlined,
  BellOutlined,
  MoonOutlined,
  DeleteOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../stores/auth'
import styles from './Settings.module.css'

const Settings: React.FC = () => {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [passwordForm] = Form.useForm()
  const [changingPassword, setChangingPassword] = useState(false)
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
    marketing: false,
  })

  const handleChangePassword = async (_values: any) => {
    setChangingPassword(true)
    try {
      // TODO: 调用修改密码 API
      // await authApi.changePassword(values)
      message.success('密码修改成功')
      passwordForm.resetFields()
    } catch {
      message.error('修改失败，请稍后重试')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleDeleteAccount = () => {
    // TODO: 账号注销流程
    message.info('账号注销功能即将上线')
  }

  return (
    <div className={styles.settingsPage}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>设置</h1>
        <p className={styles.pageSubtitle}>管理账号安全与个性化偏好</p>
      </div>

      <div className={styles.grid}>
        {/* 左侧：账号安全 */}
        <div className={styles.leftCol}>
          <Card
            className={styles.settingsCard}
            bordered={false}
            title={
              <div className={styles.cardHeader}>
                <LockOutlined className={styles.cardIcon} />
                <span>修改密码</span>
              </div>
            }
          >
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handleChangePassword}
              className={styles.settingsForm}
            >
              <Form.Item
                name="currentPassword"
                label="当前密码"
                rules={[{ required: true, message: '请输入当前密码' }]}
              >
                <Input.Password
                  prefix={<SafetyOutlined />}
                  placeholder="当前密码"
                />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 8, message: '密码至少8位' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="新密码"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="确认新密码"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'))
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="确认新密码"
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={changingPassword}
                icon={<SaveOutlined />}
                className={styles.saveBtn}
              >
                修改密码
              </Button>
            </Form>
          </Card>

          <Card
            className={styles.dangerCard}
            bordered={false}
            title={
              <div className={styles.cardHeader}>
                <DeleteOutlined className={styles.dangerIcon} />
                <span>危险区域</span>
              </div>
            }
          >
            <div className={styles.dangerBody}>
              <div>
                <div className={styles.dangerTitle}>退出登录</div>
                <div className={styles.dangerDesc}>退出当前账号，返回登录页面</div>
              </div>
              <Button
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
                className={styles.logoutBtn}
              >
                退出登录
              </Button>
            </div>
            <Divider className={styles.divider} />
            <div className={styles.dangerBody}>
              <div>
                <div className={styles.dangerTitle}>注销账号</div>
                <div className={styles.dangerDesc}>永久删除账号及所有数据，此操作不可恢复</div>
              </div>
              <Button
                danger
                onClick={handleDeleteAccount}
                className={styles.deleteBtn}
              >
                注销账号
              </Button>
            </div>
          </Card>
        </div>

        {/* 右侧：通知与偏好 */}
        <div className={styles.rightCol}>
          <Card
            className={styles.settingsCard}
            bordered={false}
            title={
              <div className={styles.cardHeader}>
                <BellOutlined className={styles.cardIcon} />
                <span>通知设置</span>
              </div>
            }
          >
            <div className={styles.switchList}>
              <div className={styles.switchItem}>
                <div>
                  <div className={styles.switchLabel}>邮件通知</div>
                  <div className={styles.switchDesc}>接收交易信号、账户变动的邮件提醒</div>
                </div>
                <Switch
                  checked={notifications.email}
                  onChange={(v) => setNotifications({ ...notifications, email: v })}
                  className={notifications.email ? styles.switchActive : ''}
                />
              </div>
              <Divider className={styles.divider} />
              <div className={styles.switchItem}>
                <div>
                  <div className={styles.switchLabel}>短信通知</div>
                  <div className={styles.switchDesc}>接收重要提醒的短信通知</div>
                </div>
                <Switch
                  checked={notifications.sms}
                  onChange={(v) => setNotifications({ ...notifications, sms: v })}
                />
              </div>
              <Divider className={styles.divider} />
              <div className={styles.switchItem}>
                <div>
                  <div className={styles.switchLabel}>推送通知</div>
                  <div className={styles.switchDesc}>浏览器推送实时信号提醒</div>
                </div>
                <Switch
                  checked={notifications.push}
                  onChange={(v) => setNotifications({ ...notifications, push: v })}
                />
              </div>
              <Divider className={styles.divider} />
              <div className={styles.switchItem}>
                <div>
                  <div className={styles.switchLabel}>营销信息</div>
                  <div className={styles.switchDesc}>接收优惠活动、产品更新的推广信息</div>
                </div>
                <Switch
                  checked={notifications.marketing}
                  onChange={(v) => setNotifications({ ...notifications, marketing: v })}
                />
              </div>
            </div>
          </Card>

          <Card
            className={styles.settingsCard}
            bordered={false}
            title={
              <div className={styles.cardHeader}>
                <MoonOutlined className={styles.cardIcon} />
                <span>外观偏好</span>
              </div>
            }
          >
            <div className={styles.switchList}>
              <div className={styles.switchItem}>
                <div>
                  <div className={styles.switchLabel}>减少动态效果</div>
                  <div className={styles.switchDesc}>关闭页面动画，提升可访问性</div>
                </div>
                <Switch defaultChecked={false} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Settings
