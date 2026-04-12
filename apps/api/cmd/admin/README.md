# Admin CLI 工具

管理后台用户管理命令行工具。

## 功能

- `create` - 创建新的 admin 用户
- `reset-password` - 重置 admin 用户密码
- `list` - 列出所有 admin 用户
- `set-admin` - 将普通用户设置为 admin
- `unset-admin` - 取消用户的 admin 权限

## 使用

### 1. 创建 Admin 用户

```bash
cd apps/api
go run cmd/admin/main.go create
```

按提示输入：
- 用户名
- 邮箱
- 密码（输入时不显示）
- 确认密码

### 2. 重置密码

```bash
go run cmd/admin/main.go reset-password
```

按提示输入用户名/邮箱和新密码。

### 3. 列出所有 Admin

```bash
go run cmd/admin/main.go list
```

### 4. 设置/取消 Admin 权限

```bash
# 将普通用户设为 admin
go run cmd/admin/main.go set-admin

# 取消用户的 admin 权限
go run cmd/admin/main.go unset-admin
```

## 环境配置

工具会读取 `.env` 文件中的数据库配置：

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=stock
DB_PASSWORD=stock123
DB_NAME=stock_analysis
```

## 登录管理后台

1. 启动 web-admin 服务：`cd apps/web-admin && pnpm dev`
2. 访问 http://localhost:5174/login
3. 使用上面创建的 admin 用户名/密码登录
