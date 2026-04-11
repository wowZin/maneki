# 网关安全修复清单

> 本文档记录所有安全漏洞修复情况，供生产环境部署前验证

---

## 修复概览

| 序号 | 风险项 | 严重程度 | 状态 |
|-----|--------|---------|------|
| 1 | Admin IP白名单路径错误 | 🔴 严重 | ✅ 已修复 |
| 2 | CORS配置过于宽松 | 🔴 严重 | ✅ 已修复 |
| 3 | JWT Token无黑名单校验 | 🔴 严重 | ✅ 已修复 |
| 4 | 管理员密码重置无二次确认 | 🔴 严重 | ✅ 已修复 |
| 5 | SQL注入风险 | 🟠 高 | ✅ 已修复 |
| 6 | 批量结算无幂等保护 | 🟠 高 | ✅ 已修复 |
| 7 | 配置更新接口未实现 | 🔴 严重 | ✅ 已修复 |
| 8 | DEBUG模式默认开启 | 🟡 中 | ✅ 已修复 |
| 9 | SECRET_KEY使用默认弱密钥 | 🟡 中 | ✅ 已修复 |
| 10 | 限流策略可被绕过 | 🟡 中 | ✅ 已修复 |

---

## 详细修复内容

### 1. Admin IP白名单路径错误 [CRITICAL]

**问题**：白名单检查路径 `/admin` 与实际路由 `/api/v1/admin` 不匹配

**修复** (`app/middleware/security.py`):
```python
# 修复前
if not path.startswith("/admin"):
    return await call_next(request)

# 修复后
if not path.startswith("/api/v1/admin"):
    return await call_next(request)
```

**验证方法**:
```bash
curl -H "X-Forwarded-For: 1.2.3.4" http://your-api/api/v1/admin/users
# 应该返回 403 Forbidden（非白名单IP）
```

---

### 2. CORS配置过于宽松 [HIGH]

**问题**：`allow_methods=["*"]` 和 `allow_headers=["*"]` 过于宽松

**修复** (`app/main.py`):
```python
# 修复前
allow_methods=["*"],
allow_headers=["*"],

# 修复后
allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-CSRF-Token"],
expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
max_age=600,
```

---

### 3. JWT Token无黑名单校验 [HIGH]

**问题**：用户登出后Token仍有效，存在重放攻击风险

**修复** (`app/core/auth.py`):
```python
class CustomJWTStrategy(JWTStrategy):
    """自定义JWT策略，增加黑名单检查"""

    async def read_token(self, token: str, user_manager):
        # 先检查黑名单
        if await token_blacklist.is_blacklisted(token):
            return None
        return await super().read_token(token, user_manager)
```

---

### 4. 管理员密码重置无二次确认 [HIGH]

**问题**：可直接重置任意用户密码，无二次验证

**修复** (`app/api/v1/admin.py`):
- 添加管理员密码二次确认
- 生成强密码（包含大小写、数字、特殊字符）
- 记录详细审计日志
- 添加通知机制

**新请求格式**:
```json
{
  "admin_password": "当前管理员密码",
  "notify_user": true
}
```

---

### 5. SQL注入风险 [HIGH]

**问题**：搜索查询直接拼接用户输入

**修复** (`app/api/v1/admin.py`):
```python
def sanitize_search_term(term: str) -> str:
    """清理搜索词，防止SQL注入"""
    import re
    cleaned = re.sub(r'[^\w\s\u4e00-\u9fff@.-]', '', term)
    return cleaned[:100]
```

---

### 6. 批量结算无幂等保护 [HIGH]

**问题**：重复点击可能导致重复结算

**修复** (`app/api/v1/admin.py`):
- 添加 `idempotency_key` 幂等性Key
- 添加 `dry_run` 试运行模式
- Redis记录已处理的Key（24小时过期）

**新请求格式**:
```json
{
  "idempotency_key": "uuid-or-random-string",
  "dry_run": false
}
```

---

### 7. 配置更新接口未实现 [HIGH]

**问题**：空实现，未真正持久化配置

**修复** (`app/api/v1/admin.py`):
- 定义可修改配置项白名单
- 敏感配置（金额类）需要详细原因
- 验证配置值范围
- 持久化到数据库或Redis
- 完整审计日志

---

### 8. DEBUG模式默认开启 [MEDIUM]

**修复** (`app/core/config.py`):
```python
# 修复前
DEBUG: bool = True

# 修复后
DEBUG: bool = False
```

---

### 9. SECRET_KEY使用默认弱密钥 [MEDIUM]

**修复** (`app/core/config.py`):
```python
# 修复前
SECRET_KEY: str = "your-secret-key-change-in-production..."

# 修复后
SECRET_KEY: str = ""  # 未设置时启动报错
```

**启动检查**:
```python
def get_jwt_strategy() -> CustomJWTStrategy:
    secret = settings.SECRET_KEY
    if not secret:
        raise ValueError("SECRET_KEY must be set in production")
    ...
```

---

### 10. 限流策略可被绕过 [MEDIUM]

**问题**：攻击者可伪造 `X-Forwarded-For` 绕过限流

**修复** (`app/middleware/rate_limit.py`):
```python
def _get_client_id(self, request: Request) -> str:
    client_host = request.client.host if request.client else "unknown"

    # 仅当客户端来自受信任的内部网络时，才使用代理头
    trusted_networks = ["127.0.0.1", "::1", "10.0.0.0/8", ...]

    is_trusted = ...

    if is_trusted:
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

    # 不信任代理头，使用直接连接地址
    return client_host
```

---

## 生产环境部署检查清单

### 环境变量配置

```bash
# 必须设置
export SECRET_KEY=$(openssl rand -hex 32)
export DEBUG=false
export ADMIN_IP_WHITELIST="你的办公IP/32,10.0.0.0/8"

# 建议设置
export CORS_ORIGINS="https://your-domain.com"
```

### 启动验证

```bash
# 1. 启动应用
docker-compose up -d

# 2. 检查启动日志（SECRET_KEY检查）
docker-compose logs api | grep -i "error\|secret"
# 应该没有SECRET_KEY相关错误

# 3. 验证Admin IP白名单（从非白名单IP访问）
curl http://api/api/v1/admin/users
# 应该返回 403 Forbidden

# 4. 验证CORS配置
curl -H "Origin: https://evil.com" http://api/api/v1/stocks
# 应该被CORS策略阻止

# 5. 验证限流
curl http://api/
# 响应头应包含 X-RateLimit-Limit

# 6. 验证安全头
curl -I http://api/
# 应包含 X-Content-Type-Options: nosniff
```

---

## API变更说明

### 破坏性变更

以下API请求格式已变更，需要同步更新前端：

1. **POST /api/v1/admin/users/{id}/reset-password**
   ```json
   // 新请求格式
   {
     "admin_password": "string",
     "notify_user": true
   }
   ```

2. **POST /api/v1/admin/rebates/batch-settle**
   ```json
   // 新请求格式
   {
     "idempotency_key": "string (>=16字符)",
     "dry_run": false
   }
   ```

3. **PUT /api/v1/admin/settings**
   ```json
   // 新请求格式
   {
     "category": "rebate|pricing|system",
     "key": "string",
     "value": "any",
     "reason": "string"
   }
   ```

---

## 安全测试建议

### 自动化安全测试

```bash
# 1. SQL注入测试
sqlmap -u "http://api/api/v1/admin/users?search=test" --batch

# 2. 限流绕过测试
for i in {1..110}; do curl -s -H "X-Forwarded-For: 1.2.3.$i" http://api/; done
# 应该大部分请求返回 429

# 3. CORS测试
curl -H "Origin: https://evil.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS http://api/api/v1/auth/login
# 应该不返回 Access-Control-Allow-Origin

# 4. 安全头检查
nmap --script http-security-headers -p 8000 api

# 5. JWT安全测试
token="eyJ..."
curl http://api/api/v1/protected -H "Authorization: Bearer $token"
# 登出后再次请求，应该返回 401
```

---

## 后续安全建议

1. **定期安全审计**：每季度进行一次代码安全审查
2. **依赖更新**：每月更新依赖包，修复已知漏洞
3. **日志监控**：配置异常请求告警（如大量4xx/5xx）
4. **渗透测试**：上线前进行专业渗透测试
5. **漏洞赏金**：考虑建立漏洞赏金计划

---

*文档版本: v1.0*
*修复日期: 2026-04-11*
