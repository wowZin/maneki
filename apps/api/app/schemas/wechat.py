"""
微信认证相关 Schema
"""

from typing import Optional
from pydantic import BaseModel, Field


# ========== 微信公众号 OAuth 登录 ==========

class WechatMPAuthRequest(BaseModel):
    """微信公众号 OAuth 登录请求

    前端流程：
    1. 引导用户访问微信授权链接，获取 code
    2. 将 code 传给后端换取 token
    """
    code: str = Field(..., description="微信授权临时票据")
    state: Optional[str] = Field(None, description="状态参数（防CSRF）")


class WechatMPAuthResponse(BaseModel):
    """微信公众号登录响应"""
    access_token: str = Field(..., description="JWT Token")
    token_type: str = Field(default="bearer")
    user_info: dict = Field(..., description="用户信息")
    is_new_user: bool = Field(..., description="是否新注册用户")


# ========== 微信小程序登录 ==========

class WechatMiniLoginRequest(BaseModel):
    """微信小程序静默登录请求

    前端流程：
    1. 调用 wx.login() 获取 code
    2. 将 code 传给后端换取 token
    """
    code: str = Field(..., description="小程序登录临时 code")
    # 可选：如果需要获取手机号
    encrypted_data: Optional[str] = Field(None, description="加密数据（获取手机号用）")
    iv: Optional[str] = Field(None, description="加密算法的初始向量")


class WechatMiniLoginResponse(BaseModel):
    """微信小程序登录响应"""
    access_token: str = Field(..., description="JWT Token")
    token_type: str = Field(default="bearer")
    user_info: dict = Field(..., description="用户信息")
    is_new_user: bool = Field(..., description="是否新注册用户")
    need_bind_phone: bool = Field(..., description="是否需要绑定手机号")


# ========== 微信小程序获取手机号 ==========

class WechatMiniPhoneRequest(BaseModel):
    """微信小程序获取手机号请求"""
    code: str = Field(..., description="小程序手机号获取凭证 code")
    # 或者使用加密数据方式
    encrypted_data: Optional[str] = Field(None, description="加密数据")
    iv: Optional[str] = Field(None, description="初始向量")


class WechatMiniPhoneResponse(BaseModel):
    """微信小程序手机号响应"""
    phone_number: str = Field(..., description="手机号")
    pure_phone_number: str = Field(..., description="不带区号的手机号")
    country_code: str = Field(..., description="区号")


# ========== 微信用户信息更新 ==========

class WechatUserInfoUpdate(BaseModel):
    """更新微信用户信息（前端获取后传给后端）"""
    nickname: Optional[str] = Field(None, description="微信昵称")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    # 小程序场景可能还需要
    encrypted_data: Optional[str] = Field(None, description="加密用户数据")
    iv: Optional[str] = Field(None, description="初始向量")


# ========== 微信配置（前端用） ==========

class WechatMPConfigResponse(BaseModel):
    """微信公众号配置（给前端用于初始化 JS-SDK）"""
    app_id: str = Field(..., description="微信公众号 AppID")
    # JS-SDK 配置
    timestamp: str = Field(..., description="时间戳")
    nonce_str: str = Field(..., description="随机字符串")
    signature: str = Field(..., description="签名")
    # OAuth 链接（可选，后端直接拼好返回）
    oauth_url: Optional[str] = Field(None, description="微信授权链接")


class WechatMiniConfigResponse(BaseModel):
    """微信小程序配置"""
    app_id: str = Field(..., description="微信小程序 AppID")


# ========== 绑定/解绑 ==========

class BindWechatRequest(BaseModel):
    """绑定微信账号到已有账号"""
    code: str = Field(..., description="微信授权 code")
    bind_type: str = Field(default="mp", description="绑定类型: mp(公众号), mini(小程序)")


class BindWechatResponse(BaseModel):
    """绑定响应"""
    success: bool
    message: str
    wechat_unionid: Optional[str] = None
