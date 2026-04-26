# Quickstart: 007-user-sms-login

## 开发环境启动

```bash
# 1. 确保在 feature 分支
git checkout 007-user-sms-login

# 2. 启动后端（含热重载）
cd apps/api
go run cmd/main.go

# 3. 启动前端（新开终端）
cd apps/web
pnpm dev
```

## 依赖服务

- PostgreSQL: 本地或 Docker (`docker run -d -p 5432:5432 postgres:15`)
- Redis: 本地或 Docker (`docker run -d -p 6379:6379 redis:7`)
- 阿里云短信: 配置环境变量 `ALICLOUD_ACCESS_KEY`, `ALICLOUD_SECRET_KEY`

## 数据库迁移

```bash
cd apps/api
go run migrations/run.go
```

## 关键文件速查

| 文件 | 作用 |
|------|------|
| `apps/api/internal/handler/auth.go` | 登录/注册/短信/密码 handler |
| `apps/api/internal/model/user.go` | User 实体定义 |
| `apps/api/internal/repository/user.go` | User DB 查询 |
| `apps/api/internal/service/sms.go` | 阿里云短信服务 |
| `apps/web/src/pages/Login.tsx` | 登录页面 |
| `apps/web/src/pages/Register.tsx` | 注册页面 |

## 测试登录流程

1. 打开 `http://localhost:5173/login`
2. 选择"短信登录" Tab
3. 输入手机号，点击"获取验证码"
4. 查看短信（或检查后端日志中的验证码）
5. 输入验证码，点击"登录"
6. 登录成功后跳转首页

## 测试密码登录

1. 先完成短信登录（自动注册）
2. 进入"我的"页面设置密码
3. 退出登录
4. 在登录页选择"密码登录" Tab
5. 输入手机号/昵称 + 密码登录
