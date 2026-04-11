"""
用户模型
使用 FastAPI-Users
"""

from datetime import datetime
from typing import Optional, List

from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID
from sqlalchemy import String, Boolean, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(SQLAlchemyBaseUserTableUUID, Base):
    """用户表 - 继承 FastAPI-Users 基础用户表

    支持多种登录方式：
    1. 邮箱+密码登录（默认）
    2. 微信公众号 OAuth 登录
    3. 微信小程序静默登录
    """

    __tablename__ = "users"

    # ========== 基础信息 ==========
    email: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    username: Mapped[Optional[str]] = mapped_column(
        String(50), unique=True, index=True, nullable=True
    )
    full_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # 昵称（微信昵称优先）
    nickname: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # ========== 用户状态 ==========
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ========== 时间戳 ==========
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # ========== 业务相关 ==========
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # ========== 微信生态登录（核心字段） ==========
    # 微信 UnionID - 同一主体下的唯一标识，多应用互通
    wechat_unionid: Mapped[Optional[str]] = mapped_column(
        String(64), unique=True, index=True, nullable=True,
        comment="微信UnionID，同一主体下多应用唯一"
    )

    # 微信公众号 OpenID
    wechat_mp_openid: Mapped[Optional[str]] = mapped_column(
        String(64), unique=True, index=True, nullable=True,
        comment="微信公众号OpenID"
    )

    # 微信小程序 OpenID
    wechat_mini_openid: Mapped[Optional[str]] = mapped_column(
        String(64), unique=True, index=True, nullable=True,
        comment="微信小程序OpenID"
    )

    # 微信开放平台 OpenID（APP登录用，预留）
    wechat_open_openid: Mapped[Optional[str]] = mapped_column(
        String(64), unique=True, index=True, nullable=True,
        comment="微信开放平台OpenID（APP）"
    )

    # 微信小程序会话密钥（敏感，仅服务端使用）
    wechat_session_key: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True,
        comment="微信小程序session_key，用于解密敏感数据"
    )

    # 微信授权登录类型
    wechat_auth_type: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="微信登录类型: mp_oauth(公众号), mini_app(小程序), open_app(APP)"
    )

    # ========== 登录方式标记 ==========
    # 标记用户是如何注册的，便于后续统计和业务处理
    register_source: Mapped[str] = mapped_column(
        String(20), default="email", nullable=False,
        comment="注册来源: email, wechat_mp, wechat_mini, wechat_open"
    )

    # ========== VIP 体系 ==========
    vip_level: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="VIP等级: 0=普通用户, 1=VIP"
    )
    vip_expire_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True,
        comment="VIP过期时间"
    )

    # ========== 辅助方法 ==========
    @property
    def display_name(self) -> str:
        """获取显示名称（优先级：nickname > full_name > username > email > 手机号）"""
        return (
            self.nickname
            or self.full_name
            or self.username
            or self.email
            or self.phone
            or "用户"
        )

    @property
    def is_wechat_user(self) -> bool:
        """判断是否微信用户"""
        return any([
            self.wechat_unionid,
            self.wechat_mp_openid,
            self.wechat_mini_openid,
        ])

    @property
    def need_bind_phone(self) -> bool:
        """判断是否需要绑定手机号（微信用户可能需要）"""
        return not self.phone and self.is_wechat_user

    @property
    def is_vip(self) -> bool:
        """判断是否为有效VIP（包含SVIP）"""
        if self.vip_level < 1:
            return False
        if self.vip_expire_at and self.vip_expire_at < datetime.utcnow():
            return False
        return True

    @property
    def is_svip(self) -> bool:
        """判断是否为有效SVIP"""
        if self.vip_level < 2:
            return False
        if self.vip_expire_at and self.vip_expire_at < datetime.utcnow():
            return False
        return True

    @property
    def vip_tier(self) -> str:
        """获取VIP等级名称"""
        if self.is_svip:
            return "svip"
        elif self.is_vip:
            return "vip"
        return "free"

    # ========== 关联关系 ==========
    agents: Mapped[List["UserAgent"]] = relationship(
        "UserAgent",
        back_populates="user",
        lazy="dynamic",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, username={self.username})>"
