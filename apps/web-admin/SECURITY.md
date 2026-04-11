# Admin 后台安全指南

## 1. 认证与授权

### 1.1 Token 机制
- 使用 JWT Token 认证
- Token 有效期：2小时
- Refresh Token 有效期：7天
- 退出登录时立即失效 Token

### 1.2 管理员权限
- 必须设置 `is_superuser` 标志
- 所有敏感操作记录审计日志
- 密码要求：12位以上，包含大小写、数字、特殊字符

## 2. 前端安全措施

### 2.1 已实现
- [x] XSS 过滤（`sanitizeHtml`）
- [x] 请求签名（Nonce + 时间戳）
- [x] 响应头安全检查
- [x] 会话超时自动退出（30分钟）
- [x] 请求限流（Rate Limiter）

### 2.2 Content Security Policy (CSP)
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https:;
connect-src 'self' https://api.yourdomain.com;
frame-ancestors 'none';
```

## 3. 部署安全

### 3.1 Nginx 配置要点
- 强制 HTTPS
- 安全响应头（X-Frame-Options, CSP 等）
- 请求限流（10r/s）
- 连接数限制（每 IP 10 个）
- 禁止访问敏感文件

### 3.2 Docker 部署示例
```yaml
version: '3'
services:
  admin-web:
    image: maneki-admin:latest
    ports:
      - "8080:80"
    environment:
      - VITE_API_URL=https://api.yourdomain.com
    networks:
      - backend
    # 资源限制
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
    # 只读文件系统
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
```

## 4. 后端配合

### 4.1 需要后端实现
- [ ] IP 白名单（可选）
- [ ] 登录失败锁定（5次失败后锁定15分钟）
- [ ] 操作审计日志
- [ ] 敏感操作二次确认（短信/邮件验证码）
- [ ] 异地登录提醒

### 4.2 API 安全建议
```python
# FastAPI 示例
from fastapi import Security, HTTPException
from slowapi import Limiter

# 登录限流
@router.post("/auth/login")
@limiter.limit("5/minute")  # 每分钟5次
def login(...):
    pass

# 管理员权限检查
def require_admin(user: User = Security(get_current_user)):
    if not user.is_superuser:
        raise HTTPException(403, "需要管理员权限")
    return user
```

## 5. 运维监控

### 5.1 需要监控的指标
- 登录失败次数（异常检测）
- 请求频率（CC 攻击）
- 错误率（500 错误突增）
- 会话数（并发用户数）

### 5.2 日志收集
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "warning",
  "event": "login_failed",
  "ip": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "username": "admin",
  "reason": "invalid_password"
}
```

## 6. 安全测试清单

- [ ] 暴力破解防护测试
- [ ] XSS 注入测试
- [ ] CSRF 测试
- [ ] 会话劫持测试
- [ ] 点击劫持测试（iframe 嵌入）
- [ ] 敏感信息泄露检查
- [ ] API 未授权访问测试

## 7. 应急响应

### 发现异常登录
1. 立即重置所有管理员密码
2. 检查审计日志
3. 封禁可疑 IP
4. 检查数据完整性

### DDoS 攻击
1. 启用 CDN 防护
2. 限制请求频率
3. 临时封禁攻击 IP
