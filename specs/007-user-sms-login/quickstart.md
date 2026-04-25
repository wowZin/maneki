# Quickstart: 007 用户认证系统

**Feature**: 用户认证（短信验证码 + 账号密码 + 注册 + 忘记密码）
**Date**: 2026-04-25

## 本地开发环境准备

### 1. 启动依赖服务

```bash
# 从项目根目录
docker compose -f infra/docker-compose.dev.yml up -d timescaledb redis
```

Wait for health checks:
```bash
docker compose -f infra/docker-compose.dev.yml ps
```

### 2. 配置环境变量

Backend (`apps/api/.env`):
```bash
SMS_MODE=mock              # mock / aliyun
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,*.maneki.cn
ALIYUN_ACCESS_KEY_ID=your-ak
ALIYUN_ACCESS_KEY_SECRET=your-sk
ALIYUN_SMS_SIGN_NAME=你的短信签名
ALIYUN_SMS_TEMPLATE_CODE=SMS_xxxxxx
ALIYUN_PNS_APP_KEY=你的号码认证AppKey
```

Frontend (`apps/web/.env.development`):
```bash
VITE_API_URL=http://localhost:8080
```

**Mock 模式**：
- 号码认证接口固定返回成功（模拟通过）
- 短信验证码固定为 `123456`，并打印到后端日志

### 3. 启动后端 API

```bash
# Docker（推荐，支持热重载）
docker compose -f infra/docker-compose.dev.yml up -d api

# 或本地运行
cd apps/api
go run cmd/main.go
```

Health check:
```bash
curl http://localhost:8080/health
```

### 4. 启动前端

```bash
cd apps/web
pnpm dev
```

访问 `http://localhost:5173`。

## 验证各登录方式

### 账号密码登录

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"password123"}'
```

### 手机号登录（号码认证 - Mock）

```bash
# 获取 Token
curl -X POST http://localhost:8080/api/v1/auth/phone/token

# 号码认证登录
curl -X POST http://localhost:8080/api/v1/auth/phone/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","sp_token":"mock_token"}'
```

### 手机号登录（短信验证码）

```bash
# 发送验证码
curl -X POST http://localhost:8080/api/v1/auth/phone/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000"}'

# 验证码登录（Mock 模式 code 为 123456）
curl -X POST http://localhost:8080/api/v1/auth/phone/login-by-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"123456"}'
```

### 用户注册

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","email":"new@example.com","password":"Pass1234"}'
```

### 忘记密码重置

```bash
# 发送验证码
curl -X POST http://localhost:8080/api/v1/auth/forgot-password/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000"}'

# 重置密码
curl -X POST http://localhost:8080/api/v1/auth/forgot-password/reset \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"123456","new_password":"NewPass123"}'
```

## 数据库迁移

首次部署前，确保 users 表字段和索引：

```sql
-- 用户名唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- 手机号唯一索引（排除空值）
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users (phone)
WHERE phone IS NOT NULL AND phone <> '';
```

## 生产环境部署要点

### 阿里云配置

- **号码认证**：阿里云控制台创建 H5 应用，获取 AppKey
- **短信服务**：申请签名和模板，确保审核通过
- **RAM 授权**：`AliyunDYPNSFullAccess` + `AliyunDysmsFullAccess`

### CORS 域名

生产环境设置 `CORS_ORIGINS` 为实际域名：
```bash
CORS_ORIGINS=https://app.maneki.cn,https://admin.maneki.cn
```

## 测试检查清单

### 账号密码登录
- [ ] 正确用户名密码登录成功，返回 JWT
- [ ] 错误密码提示"用户名或密码错误"
- [ ] 未注册用户无法登录

### 手机号登录
- [ ] 号码认证一键登录成功（手机浏览器）
- [ ] PC 浏览器自动降级短信验证码
- [ ] 新手机号自动注册并登录
- [ ] 60 秒内重复请求验证码被限制

### 注册
- [ ] 填写用户名/邮箱/密码成功注册
- [ ] 用户名重复被拒绝
- [ ] 密码复杂度不足被拒绝
- [ ] 注册成功后自动登录

### 忘记密码
- [ ] 手机号验证通过后可重置密码
- [ ] 新密码复杂度校验
- [ ] 重置成功后自动登录

### 通用
- [ ] 登录后刷新页面保持登录状态
- [ ] 退出登录清除状态
- [ ] "记住我"功能区分长期/短期会话
