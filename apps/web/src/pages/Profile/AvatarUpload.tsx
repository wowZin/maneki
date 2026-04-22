/**
 * 头像上传组件
 */

import React, { useState } from 'react'
import { Upload, message } from 'antd'
import type { UploadProps } from 'antd'
import { CameraOutlined, LoadingOutlined } from '@ant-design/icons'
import { userApi } from '../../services/user'
import { useUserProfileStore } from '../../stores/userProfile'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface AvatarUploadProps {
  avatarUrl?: string
  nickname?: string
  onSuccess?: (url: string) => void
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({ avatarUrl, nickname, onSuccess }) => {
  const [loading, setLoading] = useState(false)
  const { updateAvatar } = useUserProfileStore()

  const beforeUpload = (file: File) => {
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png'
    if (!isJpgOrPng) {
      message.error('仅支持 JPG/PNG 格式')
      return false
    }
    const isLt5M = file.size / 1024 / 1024 < 5
    if (!isLt5M) {
      message.error('图片大小不能超过 5MB')
      return false
    }
    return true
  }

  const customRequest: UploadProps['customRequest'] = async ({ file, onSuccess: onUploadSuccess, onError }) => {
    try {
      setLoading(true)
      const result = await userApi.uploadAvatar(file as File)
      const fullUrl = result.avatar_url.startsWith('http') ? result.avatar_url : `${API_BASE_URL}${result.avatar_url}`
      updateAvatar(fullUrl)
      onSuccess?.(fullUrl)
      onUploadSuccess?.(result)
      message.success('头像上传成功')
    } catch (err: any) {
      message.error(err.response?.data?.message || '上传失败')
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Upload
      showUploadList={false}
      beforeUpload={beforeUpload}
      customRequest={customRequest}
      accept="image/jpeg,image/png"
    >
      <div
        style={{
          position: 'relative',
          width: 96,
          height: 96,
          borderRadius: '50%',
          cursor: 'pointer',
          overflow: 'hidden',
          border: '3px solid rgba(59, 130, 246, 0.2)',
          boxShadow: '0 4px 16px rgba(59, 130, 246, 0.15)',
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={nickname || 'avatar'}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, var(--primary-100), var(--primary-200))',
              color: 'var(--primary-600)',
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            {nickname?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.3s ease',
          }}
          className="avatar-upload-overlay"
        >
          {loading ? (
            <LoadingOutlined style={{ fontSize: 24, color: '#fff' }} />
          ) : (
            <CameraOutlined style={{ fontSize: 24, color: '#fff' }} />
          )}
        </div>
      </div>
      <style>{`
        .avatar-upload-overlay:hover {
          opacity: 1 !important;
        }
      `}</style>
    </Upload>
  )
}

export default AvatarUpload
