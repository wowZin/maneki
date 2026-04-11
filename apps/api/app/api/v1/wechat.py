"""
微信认证相关 API
处理微信公众号、小程序的登录流程
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.wechat import wechat_service, WechatError
from app.core.auth import get_jwt_strategy, current_active_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.wechat import (
    WechatMPAuthRequest,
    WechatMPAuthResponse,
    WechatMiniLoginRequest,
    WechatMiniLoginResponse,
    WechatMiniPhoneRequest,
    WechatMiniPhoneResponse,
    WechatUserInfoUpdate,
    WechatMPConfigResponse,
    WechatMiniConfigResponse,
    BindWechatRequest,
    BindWechatResponse,
)
from app.crud.user import user_crud

router = APIRouter()


# ========== 微信公众号 OAuth ==========

@router.get("/mp/config", response_model=WechatMPConfigResponse)
async def get_mp_config(
    request: Request,
    redirect_uri: Optional[str] = Query(None, description="授权回调地址"),
):
    """
    获取微信公众号 JS-SDK 配置

    前端在需要调用微信 JSAPI（如扫码、定位）时先调用此接口获取配置
    """
    try:
        # 获取当前 URL（不包含 hash）
        url = str(request.url).split("#")[0]
        config = await wechat_service.get_js_sdk_config(url)

        # 如果需要，生成 OAuth 链接
        if redirect_uri:
            config["oauth_url"] = wechat_service.get_oauth_url(
                redirect_uri=redirect_uri,
                scope="snsapi_userinfo",
            )

        return config
    except WechatError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/mp/login", response_model=WechatMPAuthResponse)
async def wechat_mp_login(
    data: WechatMPAuthRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    微信公众号 OAuth 登录

    前端流程：
    1. 用户访问微信授权链接，微信重定向到回调页面
    2. 回调页面从 URL 参数获取 code
    3. 调用此接口，后端用 code 换取用户信息并登录
    """
    try:
        # 1. 用 code 换取 access_token 和 openid
        oauth_data = await wechat_service.get_oauth_access_token(data.code)
        openid = oauth_data["openid"]
        access_token = oauth_data["access_token"]
        unionid = oauth_data.get("unionid")

        # 2. 查询是否已存在该微信用户
        user = await user_crud.get_by_wechat_openid(db, openid=openid, openid_type="mp")

        # 3. 如果存在，直接登录
        if user:
            jwt_strategy = get_jwt_strategy()
            token = await jwt_strategy.write_token(user)

            return WechatMPAuthResponse(
                access_token=token,
                token_type="bearer",
                user_info={
                    "id": str(user.id),
                    "username": user.username,
                    "nickname": user.nickname,
                    "avatar_url": user.avatar_url,
                    "phone": user.phone,
                },
                is_new_user=False,
            )

        # 4. 如果不存在，获取用户信息并创建新用户
        try:
            wx_userinfo = await wechat_service.get_userinfo(access_token, openid)
        except WechatError:
            # 如果获取用户信息失败（可能是 scope=snsapi_base），用基本信息创建
            wx_userinfo = {
                "openid": openid,
                "unionid": unionid,
                "nickname": None,
                "headimgurl": None,
            }

        # 创建新用户
        user_data = {
            "username": f"wx_{openid[-8:]}",  # 临时用户名
            "email": f"{openid}@wechat.tmp",  # 临时邮箱
            "nickname": wx_userinfo.get("nickname"),
            "avatar_url": wx_userinfo.get("headimgurl"),
            "wechat_mp_openid": openid,
            "wechat_unionid": unionid or wx_userinfo.get("unionid"),
            "wechat_auth_type": "mp_oauth",
            "register_source": "wechat_mp",
            "is_active": True,
            "is_verified": True,  # 微信用户默认已验证
        }

        user = await user_crud.create_wechat_user(db, user_data)

        # 生成 JWT
        jwt_strategy = get_jwt_strategy()
        token = await jwt_strategy.write_token(user)

        return WechatMPAuthResponse(
            access_token=token,
            token_type="bearer",
            user_info={
                "id": str(user.id),
                "username": user.username,
                "nickname": user.nickname,
                "avatar_url": user.avatar_url,
                "phone": user.phone,
            },
            is_new_user=True,
        )

    except WechatError as e:
        raise HTTPException(status_code=400, detail=e.message)


# ========== 微信小程序登录 ==========

@router.get("/mini/config", response_model=WechatMiniConfigResponse)
async def get_mini_config():
    """
    获取微信小程序配置（给前端用的 AppID）
    """
    return WechatMiniConfigResponse(
        app_id=wechat_service.mini_app_id or "",
    )


@router.post("/mini/login", response_model=WechatMiniLoginResponse)
async def wechat_mini_login(
    data: WechatMiniLoginRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    微信小程序静默登录

    前端流程：
    1. 调用 wx.login() 获取 code
    2. 调用此接口，后端用 code 换取 openid 和 session_key
    3. 如果用户已存在，直接登录；如果不存在，创建新用户

    如果需要获取手机号，调用 /mini/phone 接口
    """
    try:
        # 1. code 换取 session
        session_data = await wechat_service.code_to_session(data.code)
        openid = session_data["openid"]
        session_key = session_data["session_key"]
        unionid = session_data.get("unionid")

        # 2. 查询是否已存在
        user = await user_crud.get_by_wechat_openid(
            db, openid=openid, openid_type="mini"
        )

        # 3. 如果存在，更新 session_key 并登录
        if user:
            await user_crud.update_session_key(db, user.id, session_key)

            jwt_strategy = get_jwt_strategy()
            token = await jwt_strategy.write_token(user)

            return WechatMiniLoginResponse(
                access_token=token,
                token_type="bearer",
                user_info={
                    "id": str(user.id),
                    "username": user.username,
                    "nickname": user.nickname,
                    "avatar_url": user.avatar_url,
                    "phone": user.phone,
                },
                is_new_user=False,
                need_bind_phone=not user.phone,
            )

        # 4. 如果不存在，创建新用户
        user_data = {
            "username": f"mini_{openid[-8:]}",
            "email": f"{openid}@wechat.mini",
            "wechat_mini_openid": openid,
            "wechat_unionid": unionid,
            "wechat_session_key": session_key,
            "wechat_auth_type": "mini_app",
            "register_source": "wechat_mini",
            "is_active": True,
            "is_verified": True,
        }

        user = await user_crud.create_wechat_user(db, user_data)

        jwt_strategy = get_jwt_strategy()
        token = await jwt_strategy.write_token(user)

        return WechatMiniLoginResponse(
            access_token=token,
            token_type="bearer",
            user_info={
                "id": str(user.id),
                "username": user.username,
                "nickname": user.nickname,
                "avatar_url": user.avatar_url,
                "phone": user.phone,
            },
            is_new_user=True,
            need_bind_phone=True,  # 新用户需要绑定手机号
        )

    except WechatError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/mini/phone")
async def wechat_mini_get_phone(
    data: WechatMiniPhoneRequest,
    current_user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    小程序获取手机号并绑定

    支持两种方式：
    1. 新版：使用 code 直接换取（推荐，基础库 2.21.2+）
    2. 旧版：使用 encrypted_data + iv 解密
    """
    try:
        if data.code:
            # 新版接口
            phone_info = await wechat_service.get_phone_number_via_code(data.code)
        elif data.encrypted_data and data.iv:
            # 旧版解密方式，需要 session_key
            if not current_user.wechat_session_key:
                raise HTTPException(status_code=400, detail="Session key 不存在，请重新登录")
            phone_info = wechat_service.decrypt_phone_number(
                current_user.wechat_session_key,
                data.encrypted_data,
                data.iv
            )
        else:
            raise HTTPException(status_code=400, detail="请提供 code 或 encrypted_data+iv")

        phone_number = phone_info.get("purePhoneNumber") or phone_info.get("phoneNumber")

        if not phone_number:
            raise HTTPException(status_code=400, detail="获取手机号失败")

        # 更新用户手机号
        await user_crud.update_phone(db, current_user.id, phone_number)

        return WechatMiniPhoneResponse(
            phone_number=phone_info.get("phoneNumber", phone_number),
            pure_phone_number=phone_number,
            country_code=phone_info.get("countryCode", "+86"),
        )

    except WechatError as e:
        raise HTTPException(status_code=400, detail=e.message)


# ========== 用户信息更新 ==========

@router.post("/mini/userinfo")
async def update_wechat_userinfo(
    data: WechatUserInfoUpdate,
    current_user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    更新微信用户信息（小程序场景）

    前端调用 wx.getUserProfile 或解密 getUserInfo 获取用户信息后，传给后端保存
    """
    update_data = {}

    if data.nickname:
        update_data["nickname"] = data.nickname
    if data.avatar_url:
        update_data["avatar_url"] = data.avatar_url

    # 如果有加密数据，解密获取详细信息
    if data.encrypted_data and data.iv and current_user.wechat_session_key:
        try:
            from app.core.wechat import wechat_service
            decrypted = wechat_service.decrypt_phone_number(
                current_user.wechat_session_key,
                data.encrypted_data,
                data.iv
            )
            if not update_data.get("nickname") and decrypted.get("nickName"):
                update_data["nickname"] = decrypted["nickName"]
            if not update_data.get("avatar_url") and decrypted.get("avatarUrl"):
                update_data["avatar_url"] = decrypted["avatarUrl"]
        except Exception:
            pass  # 解密失败不影响其他字段更新

    if update_data:
        await user_crud.update(db, current_user.id, update_data)

    return {"success": True, "user_info": update_data}


# ========== 绑定/解绑 ==========

@router.post("/bind", response_model=BindWechatResponse)
async def bind_wechat(
    data: BindWechatRequest,
    current_user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    将微信账号绑定到当前已登录的账号

    用于：已有邮箱账号，想绑定微信快捷登录
    """
    try:
        if data.bind_type == "mp":
            # 公众号绑定
            oauth_data = await wechat_service.get_oauth_access_token(data.code)
            openid = oauth_data["openid"]
            unionid = oauth_data.get("unionid")

            # 检查是否已被其他账号绑定
            existing = await user_crud.get_by_wechat_openid(
                db, openid=openid, openid_type="mp"
            )
            if existing and existing.id != current_user.id:
                return BindWechatResponse(
                    success=False,
                    message="该微信账号已被其他用户绑定",
                )

            update_data = {
                "wechat_mp_openid": openid,
                "wechat_unionid": unionid,
            }
            await user_crud.update(db, current_user.id, update_data)

        elif data.bind_type == "mini":
            # 小程序绑定
            session_data = await wechat_service.code_to_session(data.code)
            openid = session_data["openid"]
            unionid = session_data.get("unionid")
            session_key = session_data["session_key"]

            existing = await user_crud.get_by_wechat_openid(
                db, openid=openid, openid_type="mini"
            )
            if existing and existing.id != current_user.id:
                return BindWechatResponse(
                    success=False,
                    message="该微信账号已被其他用户绑定",
                )

            update_data = {
                "wechat_mini_openid": openid,
                "wechat_unionid": unionid,
                "wechat_session_key": session_key,
            }
            await user_crud.update(db, current_user.id, update_data)

        return BindWechatResponse(
            success=True,
            message="绑定成功",
            wechat_unionid=unionid,
        )

    except WechatError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/unbind")
async def unbind_wechat(
    unbind_type: str = Query(..., description="解绑类型: mp, mini, all"),
    current_user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    解绑微信账号
    """
    update_data = {}

    if unbind_type in ["mp", "all"]:
        update_data["wechat_mp_openid"] = None
    if unbind_type in ["mini", "all"]:
        update_data["wechat_mini_openid"] = None
        update_data["wechat_session_key"] = None
    if unbind_type == "all":
        update_data["wechat_unionid"] = None
        update_data["wechat_auth_type"] = None

    await user_crud.update(db, current_user.id, update_data)

    return {"success": True, "message": "解绑成功"}
