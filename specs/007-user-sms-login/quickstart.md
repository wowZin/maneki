# Quickstart: 手机号登录（号码认证 + 短信验证码）

**Feature**: 用户手机号登录
**Date**: 2026-04-22

## 本地开发环境准备

### 1. 启动依赖服务

```bash
# 确保 PostgreSQL 和 Redis 已启动
cd infra/
docker-compose up -d postgres redis
```

### 2. 配置阿里云环境变量（开发环境）

```bash
# apps/api 的 .env 文件
SMS_MODE=mock              # mock / aliyun
ALIYUN_ACCESS_KEY_ID=your-ak
ALIYUN_ACCESS_KEY_SECRET=your-sk
ALIYUN_SMS_SIGN_NAME=你的短信签名
ALIYUN_SMS_TEMPLATE_CODE=SMS_xxxxxx
ALIYUN_PNS_APP_KEY=你的号码认证AppKey    # 号码认证专用
```

**Mock 模式**：
- 号码认证接口固定返回成功（模拟通过）
- 短信验证码固定为 `123456`，并打印到后端日志

### 3. 前端引入阿里云 H5 SDK

```bash
# 在 apps/web/index.html 的 <head> 中加入
# <script src="https://cdn.aliyuncs.com/phone-number-server/phone-number-server.js"></script>
# 或参考阿里云文档使用 npm 包
```

### 4. 启动后端 API

```bash
cd apps/api
go run cmd/main.go
```

### 5. 启动前端

```bash
cd apps/web
pnpm dev
```

### 6. 验证接口

```bash
# 获取号码认证 Token
curl -X POST http://localhost:8080/api/v1/auth/phone/token

# 号码认证登录（Mock 模式下 sp_token 可随意填写）
curl -X POST http://localhost:8080/api/v1/auth/phone/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","sp_token":"mock_token"}'

# 发送短信验证码（Fallback）
curl -X POST http://localhost:8080/api/v1/auth/phone/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000"}'

# 短信验证码登录
curl -X POST http://localhost:8080/api/v1/auth/phone/login-by-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"123456"}'
```

## 生产环境部署要点

### 1. 阿里云控制台配置

- **号码认证服务**：在阿里云「号码认证服务」控制台创建 H5 应用，获取 AppKey
- **短信服务**：在阿里云「短信服务」控制台申请签名和模板，确保审核通过
- **RAM 授权**：为 AccessKey 授予 `AliyunDYPNSFullAccess`（号码认证）和 `AliyunDysmsFullAccess`（短信）权限

### 2. 环境变量配置

```bash
SMS_MODE=aliyun
ALIYUN_ACCESS_KEY_ID=your-production-ak
ALIYUN_ACCESS_KEY_SECRET=your-production-sk
ALIYUN_SMS_SIGN_NAME=生产签名
ALIYUN_SMS_TEMPLATE_CODE=SMS_xxxxxx
ALIYUN_PNS_APP_KEY=生产AppKey
```

### 3. 手机号唯一性

首次部署前，检查并清理 `users` 表中重复的 `phone` 值，然后添加唯一索引：

```sql
CREATE UNIQUE INDEX idx_users_phone ON users (phone) WHERE phone IS NOT NULL AND phone <> '';
```

### 4. 监控告警

- 号码认证成功率（低于 90% 告警，可能因非蜂窝环境导致）
- 短信发送成功率（低于 95% 告警）
- 登录接口 P99 延迟
- 频繁触发限流的 IP

## 测试检查清单

### 号码认证流程
- [ ] 手机浏览器打开登录页，自动检测到支持号码认证
- [ ] 输入有效手机号，点击「一键验证」，成功登录
- [ ] 使用未注册手机号，自动创建账户并登录
- [ ] 输入无效手机号格式，前端即时提示

### 短信验证码 Fallback 流程
- [ ] PC 浏览器打开登录页，自动降级为短信验证码模式
- [ ] 输入有效手机号，成功收到验证码（Mock 模式查看日志）
- [ ] 输入正确验证码，成功登录
- [ ] 60 秒内重复请求验证码，提示频率限制
- [ ] 输入错误/过期验证码，提示验证失败

### 通用
- [ ] 登录成功后刷新页面，保持登录状态
- [ ] 点击退出登录，清除状态并跳转登录页
- [ ] 登录响应格式与现有账号密码登录完全一致
