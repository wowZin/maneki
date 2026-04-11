# API 安全指南

## 已实施的安全功能

### 1. 登录保护

**登录失败锁定**
- 账号级别：5 次失败锁定 15 分钟
- IP 级别：10 次失败锁定 15 分钟
- 自动清除成功登录的记录

**配置项**
```env
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCK_DURATION=900
IP_MAX_ATTEMPTS=10
```

### 2. Token 安全

**Token 配置**
- Access Token：2 小时过期
- Refresh Token：7 天过期
- 支持 Token 黑名单（退出登录后立即失效）

**配置项**
```env
ACCESS_TOKEN_EXPIRE_MINUTES=120
REFRESH_TOKEN_EXPIRE_DAYS=7
```

### 3. IP 白名单（Admin）

**默认允许的网段**
- 127.0.0.1（本地）
- 10.0.0.0/8（私有网段）
- 172.16.0.0/12（私有网段）
- 192.168.0.0/16（私有网段）

**配置项**
```env
ADMIN_IP_WHITELIST=127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

### 4. 审计日志

**记录的操作**
- 登录成功/失败
- 退出登录
- 用户创建/更新/删除
- 密码重置
- Agent 更新
- 系统配置更新
- 返佣结算

**查询接口**
```bash
GET /api/v1/admin/audit-logs
GET /api/v1/admin/audit-logs?action=login_success
```

### 5. 安全响应头

**自动添加的响应头**
```
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: ...
Content-Security-Policy: default-src 'self'
```

### 6. 请求安全

**自动阻止**
- SQLMap 等扫描工具（User-Agent 检查）
- 超过 10MB 的请求体
- 可疑的请求模式

**限流策略**
- 登录：5/分钟
- API：100/分钟
- 敏感操作：更严格的限流

## 部署建议

### 1. Nginx 配置

```nginx
location /api/v1/admin {
    # IP 白名单（双层防护）
    allow 10.0.0.0/8;
    deny all;

    # 额外的限流
    limit_req zone=admin burst=10 nodelay;

    # 代理到后端
    proxy_pass http://backend:8000;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### 2. 环境变量

```env
# 安全密钥（生产必须修改！）
SECRET_KEY=your-very-long-random-secret-key-32-chars-min

# 登录保护
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCK_DURATION=900
IP_MAX_ATTEMPTS=10

# Token 过期时间
ACCESS_TOKEN_EXPIRE_MINUTES=120
REFRESH_TOKEN_EXPIRE_DAYS=7

# Admin IP 白名单
ADMIN_IP_WHITELIST=127.0.0.1,10.0.0.0/8

# 审计日志保留天数
AUDIT_LOG_RETENTION_DAYS=90
```

### 3. Docker Compose

```yaml
services:
  api:
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - ADMIN_IP_WHITELIST=${ADMIN_IP_WHITELIST}
    # 网络隔离
    networks:
      - backend
      - frontend
    # 资源限制
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
```

## 安全监控

### 需要监控的指标

1. **登录失败率**：异常增长可能表示暴力破解攻击
2. **限流触发次数**：大量 429 错误可能是 CC 攻击
3. **审计日志异常**：非工作时间的高频操作
4. **Admin 接口访问**：来自非白名单 IP 的请求

### 告警规则

```yaml
# 登录失败告警
- alert: HighLoginFailureRate
  expr: rate(login_failures[5m]) > 10
  for: 5m
  severity: warning

# Admin 访问异常告警
- alert: AdminAccessFromUnknownIP
  expr: admin_access_denied > 0
  severity: critical
```

## 应急响应

### 发现异常登录

1. 立即封禁可疑 IP
2. 重置受影响账号密码
3. 检查审计日志
4. 检查数据完整性

### API 接口

```bash
# 查询登录状态
GET /api/v1/auth/login/status?email=user@example.com

# 退出登录（加入黑名单）
POST /api/v1/auth/logout

# 查询审计日志
GET /api/v1/admin/audit-logs
```
