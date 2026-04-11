"""
用户 CRUD 操作
"""

from typing import Optional, Dict, Any
from uuid import UUID

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserCRUD:
    """用户数据操作"""

    async def get_by_id(self, db: AsyncSession, user_id: UUID) -> Optional[User]:
        """通过 ID 获取用户"""
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """通过邮箱获取用户"""
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_username(self, db: AsyncSession, username: str) -> Optional[User]:
        """通过用户名获取用户"""
        result = await db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def get_by_wechat_openid(
        self,
        db: AsyncSession,
        openid: str,
        openid_type: str = "mp"
    ) -> Optional[User]:
        """
        通过微信 OpenID 获取用户

        openid_type: mp(公众号), mini(小程序), open(开放平台)
        """
        if openid_type == "mp":
            result = await db.execute(
                select(User).where(User.wechat_mp_openid == openid)
            )
        elif openid_type == "mini":
            result = await db.execute(
                select(User).where(User.wechat_mini_openid == openid)
            )
        elif openid_type == "open":
            result = await db.execute(
                select(User).where(User.wechat_open_openid == openid)
            )
        else:
            # 尝试所有类型
            result = await db.execute(
                select(User).where(
                    or_(
                        User.wechat_mp_openid == openid,
                        User.wechat_mini_openid == openid,
                        User.wechat_open_openid == openid,
                    )
                )
            )
        return result.scalar_one_or_none()

    async def get_by_unionid(self, db: AsyncSession, unionid: str) -> Optional[User]:
        """通过 UnionID 获取用户（同一主体多应用唯一）"""
        result = await db.execute(
            select(User).where(User.wechat_unionid == unionid)
        )
        return result.scalar_one_or_none()

    async def create_wechat_user(
        self,
        db: AsyncSession,
        user_data: Dict[str, Any]
    ) -> User:
        """
        创建微信用户

        如果提供了 unionid，检查是否已有同一主体的账号，
        如果有，更新该账号的微信信息而不是创建新账号
        """
        unionid = user_data.get("wechat_unionid")

        # 如果存在 unionid，尝试关联已有账号
        if unionid:
            existing = await self.get_by_unionid(db, unionid)
            if existing:
                # 更新微信信息到已有账号
                update_fields = [
                    "wechat_mp_openid",
                    "wechat_mini_openid",
                    "wechat_open_openid",
                    "wechat_session_key",
                    "wechat_auth_type",
                    "nickname",
                    "avatar_url",
                ]
                for field in update_fields:
                    if field in user_data and user_data[field]:
                        setattr(existing, field, user_data[field])
                await db.commit()
                await db.refresh(existing)
                return existing

        # 检查 unionid 是否与其他 openid 冲突（有人先绑定了小程序，又用公众号登录）
        # 这种情况应该自动合并账号
        mp_openid = user_data.get("wechat_mp_openid")
        mini_openid = user_data.get("wechat_mini_openid")

        if mp_openid:
            existing = await self.get_by_wechat_openid(db, mp_openid, "mp")
            if existing:
                return await self._merge_wechat_data(db, existing, user_data)

        if mini_openid:
            existing = await self.get_by_wechat_openid(db, mini_openid, "mini")
            if existing:
                return await self._merge_wechat_data(db, existing, user_data)

        # 创建新用户
        user = User(**user_data)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    async def _merge_wechat_data(
        self,
        db: AsyncSession,
        existing: User,
        new_data: Dict[str, Any]
    ) -> User:
        """合并微信数据到已有用户"""
        merge_fields = [
            "wechat_unionid",
            "wechat_mp_openid",
            "wechat_mini_openid",
            "wechat_open_openid",
            "wechat_session_key",
            "wechat_auth_type",
            "nickname",
            "avatar_url",
        ]
        for field in merge_fields:
            if field in new_data and new_data[field] and not getattr(existing, field):
                setattr(existing, field, new_data[field])

        await db.commit()
        await db.refresh(existing)
        return existing

    async def update(
        self,
        db: AsyncSession,
        user_id: UUID,
        update_data: Dict[str, Any]
    ) -> Optional[User]:
        """更新用户信息"""
        user = await self.get_by_id(db, user_id)
        if not user:
            return None

        for key, value in update_data.items():
            if hasattr(user, key):
                setattr(user, key, value)

        await db.commit()
        await db.refresh(user)
        return user

    async def update_session_key(
        self,
        db: AsyncSession,
        user_id: UUID,
        session_key: str
    ) -> bool:
        """更新小程序 session_key"""
        user = await self.get_by_id(db, user_id)
        if not user:
            return False

        user.wechat_session_key = session_key
        await db.commit()
        return True

    async def update_phone(
        self,
        db: AsyncSession,
        user_id: UUID,
        phone: str
    ) -> bool:
        """更新手机号"""
        user = await self.get_by_id(db, user_id)
        if not user:
            return False

        user.phone = phone
        await db.commit()
        return True

    async def delete(self, db: AsyncSession, user_id: UUID) -> bool:
        """删除用户（软删除可改为更新 is_active）"""
        user = await self.get_by_id(db, user_id)
        if not user:
            return False

        await db.delete(user)
        await db.commit()
        return True


# 全局实例
user_crud = UserCRUD()
