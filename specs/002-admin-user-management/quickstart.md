# Quickstart: Admin User Management

## 1. 创建超级管理员（命令行）

```bash
cd apps/api
go run ./cmd/adminctl create --name superadmin --password YourStrongPassword
```

## 2. 修改超级管理员密码（命令行）

```bash
cd apps/api
go run ./cmd/adminctl reset-password --name superadmin --password NewPassword
```

## 3. 启动 API 服务

```bash
cd apps/api
cp .env.example .env
# 编辑 .env 配置数据库和 Redis
go run ./cmd/main.go
```

## 4. 启动管理后台前端

```bash
cd apps/web-admin
pnpm install
pnpm dev
# 访问 http://localhost:5173
```

## 5. 首次登录流程

1. 使用命令行创建的超级管理员账户名称和密码登录
2. 登录成功后进入管理后台首页
3. 在"管理员设置"页面创建普通管理员（初始密码固定为 111111）
4. 新管理员首次登录会被强制要求修改密码

## 6. 测试检查清单

- [ ] 命令行可以创建超级管理员
- [ ] 命令行可以修改超级管理员密码
- [ ] 超级管理员可以登录后台
- [ ] 超级管理员可以创建普通管理员
- [ ] 普通管理员首次登录强制修改密码
- [ ] 普通管理员看不到"管理员设置"菜单
- [ ] 禁用管理员后其会话立即失效
- [ ] 禁用用户后其会话立即失效
- [ ] 操作日志记录所有关键操作
- [ ] 30 分钟无操作后自动登出
