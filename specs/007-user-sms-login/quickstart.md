# Quickstart: 短信验证码登录

**Feature**: 用户短信验证码登录
**Date**: 2026-04-22

## 本地开发环境准备

### 1. 启动依赖服务

```bash
# 确保 PostgreSQL 和 Redis 已启动
# 开发环境通常通过 Docker Compose 启动
cd infra/
docker-compose up -d postgres redis
```

### 2. 配置短信 Mock 模式

```bash
# 在 apps/api 的 .env 或环境变量中设置
SMS_PROVIDER=mock
# 或
SMS_MOCK=true
```

Mock 模式下，验证码不会真实发送，而是：
- 打印到后端日志（可在控制台查看）
- 或者固定为 `123456`（开发专用）

### 3. 启动后端 API

```bash
cd apps/api
go run cmd/main.go
```

API 默认监听 `:8080`（具体端口取决于 `PORT` 环境变量）。

### 4. 启动前端

```bash
cd apps/web
pnpm dev
```

前端默认运行在 `http://localhost:5173`。

### 5. 验证接口

```bash
# 发送验证码
curl -X POST http://localhost:8080/api/v1/auth/sms/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000"}'

# 使用验证码登录（假设收到的验证码是 123456）
curl -X POST http://localhost:8080/api/v1/auth/sms/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"123456"}'
```

## 生产环境部署要点

### 1. 短信服务商配置

在环境变量中配置阿里云短信：

```bash
SMS_PROVIDER=aliyun
ALIYUN_ACCESS_KEY_ID=your-access-key
ALIYUN_ACCESS_KEY_SECRET=your-secret
ALIYUN_SMS_SIGN_NAME=你的短信签名
ALIYUN_SMS_TEMPLATE_CODE=SMS_xxxxxx
```

### 2. 确保 Redis 可用

验证码和频率限制完全依赖 Redis，生产环境必须确保 Redis 高可用。

### 3. 手机号唯一性

首次部署前，检查并清理 `users` 表中重复的 `phone` 值，然后添加唯一索引：

```sql
-- 先清理重复数据（保留最新的一条）
-- 然后添加唯一索引（仅对非空手机号）
CREATE UNIQUE INDEX idx_users_phone ON users (phone) WHERE phone IS NOT NULL AND phone <> '';
```

### 4. 监控告警

建议关注的指标：
- 短信发送成功率（低于 95% 告警）
- 验证码接口 QPS 和 P99 延迟
- Redis 连接状态
- 频繁触发频率限制的 IP（可能的攻击行为）

## 测试检查清单

- [ ] 输入有效手机号，60 秒内成功收到验证码（Mock 模式查看日志）
- [ ] 输入正确验证码，成功登录并拿到 Token
- [ ] 使用未注册手机号登录，自动创建账户
- [ ] 60 秒内重复请求验证码，提示频率限制
- [ ] 输入错误验证码，提示验证码错误
- [ ] 输入过期验证码，提示验证码已过期
- [ ] 登录成功后刷新页面，保持登录状态
- [ ] 点击退出登录，清除状态并跳转登录页
- [ ] 输入无效手机号格式，前端即时提示
