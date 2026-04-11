"""
微信认证核心逻辑
处理微信公众号、小程序的登录、用户信息获取等
"""

import json
import time
import hmac
import hashlib
import secrets
from typing import Optional, Dict, Any, Tuple
from urllib.parse import urlencode, parse_qs, urlparse

import httpx
from fastapi import HTTPException

from app.core.config import settings


class WechatError(Exception):
    """微信 API 错误"""
    def __init__(self, message: str, errcode: int = None):
        self.message = message
        self.errcode = errcode
        super().__init__(self.message)


class WechatAuthService:
    """微信认证服务

    支持：
    - 微信公众号 OAuth2 登录
    - 微信小程序登录
    - 微信 JS-SDK 配置生成
    """

    def __init__(self):
        # 从配置读取，如果没有则使用环境变量或占位符
        self.mp_app_id = getattr(settings, 'WECHAT_MP_APP_ID', '')
        self.mp_app_secret = getattr(settings, 'WECHAT_MP_APP_SECRET', '')
        self.mini_app_id = getattr(settings, 'WECHAT_MINI_APP_ID', '')
        self.mini_app_secret = getattr(settings, 'WECHAT_MINI_APP_SECRET', '')

        # Access Token 缓存
        self._access_token_cache: Dict[str, Tuple[str, int]] = {}

    # ========== 工具方法 ==========

    def _check_config(self, app_type: str = "mp"):
        """检查配置是否完整"""
        if app_type == "mp":
            if not self.mp_app_id or not self.mp_app_secret:
                raise WechatError("微信公众号配置不完整，请联系管理员")
        elif app_type == "mini":
            if not self.mini_app_id or not self.mini_app_secret:
                raise WechatError("微信小程序配置不完整，请联系管理员")

    async def _request(self, url: str, method: str = "GET", **kwargs) -> dict:
        """发送 HTTP 请求"""
        async with httpx.AsyncClient() as client:
            if method.upper() == "GET":
                response = await client.get(url, **kwargs)
            else:
                response = await client.post(url, **kwargs)

            try:
                data = response.json()
            except json.JSONDecodeError:
                raise WechatError(f"微信返回非 JSON 数据: {response.text}")

            # 检查微信错误码
            if "errcode" in data and data["errcode"] != 0:
                raise WechatError(
                    data.get("errmsg", "微信接口错误"),
                    errcode=data["errcode"]
                )

            return data

    # ========== Access Token ==========

    async def get_mp_access_token(self) -> str:
        """获取公众号 Access Token（全局唯一，缓存 7000 秒）"""
        self._check_config("mp")

        cache_key = f"mp_access_token"
        if cache_key in self._access_token_cache:
            token, expire_time = self._access_token_cache[cache_key]
            if time.time() < expire_time - 300:  # 提前 5 分钟过期
                return token

        url = f"https://api.weixin.qq.com/cgi-bin/token"
        params = {
            "grant_type": "client_credential",
            "appid": self.mp_app_id,
            "secret": self.mp_app_secret,
        }

        data = await self._request(url, params=params)
        token = data["access_token"]
        expires_in = data.get("expires_in", 7200)

        self._access_token_cache[cache_key] = (token, time.time() + expires_in)
        return token

    # ========== 微信公众号 OAuth ==========

    def get_oauth_url(
        self,
        redirect_uri: str,
        scope: str = "snsapi_userinfo",
        state: Optional[str] = None
    ) -> str:
        """
        生成微信公众号 OAuth 授权链接

        scope 说明：
        - snsapi_base: 静默授权，只能获取 openid
        - snsapi_userinfo: 需要用户点击同意，可获取昵称头像
        """
        self._check_config("mp")

        base_url = "https://open.weixin.qq.com/connect/oauth2/authorize"
        params = {
            "appid": self.mp_app_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scope,
        }
        if state:
            params["state"] = state

        url = f"{base_url}?{urlencode(params)}#wechat_redirect"
        return url

    async def get_oauth_access_token(self, code: str) -> dict:
        """
        使用 code 换取 OAuth Access Token 和 OpenID

        返回：
        {
            "access_token": "...",
            "expires_in": 7200,
            "refresh_token": "...",
            "openid": "...",
            "scope": "...",
            "unionid": "..."  # 如果绑定了开放平台
        }
        """
        self._check_config("mp")

        url = "https://api.weixin.qq.com/sns/oauth2/access_token"
        params = {
            "appid": self.mp_app_id,
            "secret": self.mp_app_secret,
            "code": code,
            "grant_type": "authorization_code",
        }

        return await self._request(url, params=params)

    async def get_userinfo(self, access_token: str, openid: str) -> dict:
        """
        获取微信用户信息（需要 scope=snsapi_userinfo）

        返回：
        {
            "openid": "...",
            "nickname": "...",
            "sex": 1,
            "province": "...",
            "city": "...",
            "country": "...",
            "headimgurl": "...",
            "privilege": [],
            "unionid": "..."
        }
        """
        url = "https://api.weixin.qq.com/sns/userinfo"
        params = {
            "access_token": access_token,
            "openid": openid,
            "lang": "zh_CN",
        }

        return await self._request(url, params=params)

    async def code_to_session(self, code: str) -> dict:
        """
        小程序登录：code 换取 session_key 和 openid

        返回：
        {
            "openid": "...",
            "session_key": "...",
            "unionid": "..."  # 可选
        }
        """
        self._check_config("mini")

        url = "https://api.weixin.qq.com/sns/jscode2session"
        params = {
            "appid": self.mini_app_id,
            "secret": self.mini_app_secret,
            "js_code": code,
            "grant_type": "authorization_code",
        }

        return await self._request(url, params=params)

    # ========== JS-SDK 配置 ==========

    async def get_jsapi_ticket(self) -> str:
        """获取 JSAPI Ticket（用于 JS-SDK 签名）"""
        cache_key = "jsapi_ticket"
        if cache_key in self._access_token_cache:
            ticket, expire_time = self._access_token_cache[cache_key]
            if time.time() < expire_time - 300:
                return ticket

        access_token = await self.get_mp_access_token()
        url = f"https://api.weixin.qq.com/cgi-bin/ticket/getticket"
        params = {
            "access_token": access_token,
            "type": "jsapi",
        }

        data = await self._request(url, params=params)
        ticket = data["ticket"]
        expires_in = data.get("expires_in", 7200)

        self._access_token_cache[cache_key] = (ticket, time.time() + expires_in)
        return ticket

    def generate_js_signature(self, ticket: str, nonce_str: str, timestamp: str, url: str) -> str:
        """生成 JS-SDK 签名"""
        data = {
            "jsapi_ticket": ticket,
            "noncestr": nonce_str,
            "timestamp": timestamp,
            "url": url,
        }
        string = "&".join(f"{k}={v}" for k, v in sorted(data.items()))
        return hashlib.sha1(string.encode()).hexdigest()

    async def get_js_sdk_config(self, url: str) -> dict:
        """
        获取 JS-SDK 配置

        前端使用示例：
        wx.config({
            debug: false,
            appId: config.app_id,
            timestamp: config.timestamp,
            nonceStr: config.nonce_str,
            signature: config.signature,
            jsApiList: ['scanQRCode', 'getLocation']
        });
        """
        self._check_config("mp")

        ticket = await self.get_jsapi_ticket()
        timestamp = str(int(time.time()))
        nonce_str = secrets.token_hex(16)
        signature = self.generate_js_signature(ticket, nonce_str, timestamp, url)

        return {
            "app_id": self.mp_app_id,
            "timestamp": timestamp,
            "nonce_str": nonce_str,
            "signature": signature,
        }

    # ========== 手机号解密（小程序） ==========

    def decrypt_phone_number(self, session_key: str, encrypted_data: str, iv: str) -> dict:
        """
        解密小程序获取的手机号

        使用 AES-128-CBC 解密
        """
        import base64
        from Crypto.Cipher import AES

        session_key = base64.b64decode(session_key)
        encrypted_data = base64.b64decode(encrypted_data)
        iv = base64.b64decode(iv)

        cipher = AES.new(session_key, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(encrypted_data)

        # 去除 PKCS7 填充
        pad_len = decrypted[-1]
        decrypted = decrypted[:-pad_len]

        return json.loads(decrypted.decode('utf-8'))

    async def get_phone_number_via_code(self, code: str) -> dict:
        """
        小程序新版接口：使用 code 换取手机号

        小程序基础库 2.21.2+ 支持，无需解密
        """
        access_token = await self.get_mp_access_token()
        url = f"https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token={access_token}"

        data = await self._request(url, method="POST", json={"code": code})
        return data.get("phone_info", {})


# 全局实例
wechat_service = WechatAuthService()
