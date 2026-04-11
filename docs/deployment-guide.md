# Maneki 阿里云部署指南

> 完整的本地开发到阿里云生产环境部署流程

---

## 目录

1. [部署架构](#部署架构)
2. [本地开发环境](#本地开发环境)
3. [阿里云服务器准备](#阿里云服务器准备)
4. [CI/CD 配置](#cicd-配置)
5. [GitHub Actions 部署](#github-actions-部署)
6. [阿里云效部署（备选）](#阿里云效部署备选)
7. [常见问题](#常见问题)

---

## 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub / Codeup                          │
│                      (代码仓库)                              │
└─────────────────────────┬───────────────────────────────────┘
                          │ push / tag
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 CI/CD Pipeline                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  Lint    │ -> │  Test    │ -> │  Build   │              │
│  │  Check   │    │  Coverage│    │  Push    │              │
│  └──────────┘    └──────────┘    └──────────┘              │
└─────────────────────────┬───────────────────────────────────┘
                          │ 镜像推送
                          ▼
┌─────────────────────────────────────────────────────────────┐
│          阿里云容器镜像服务 ACR                             │
│          registry.cn-hangzhou.aliyuncs.com                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ pull
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    阿里云 ECS / 轻量服务器                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                Docker Compose                         │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐    │  │
│  │  │ Nginx  │  │ FastAPI│  │PostgreSQL│ │ Redis │    │  │
│  │  │ :80/443│  │ :8000  │  │ :5432   │  │ :6379 │    │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            阿里云日志服务 SLS                        │  │
│  │        (Logtail 采集 -> 存储 -> 查询)                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 本地开发环境

### 1. 快速启动

```bash
# 1. 克隆代码
git clone <your-repo>
cd maneki

# 2. 启动基础设施（PostgreSQL, Redis）
docker-compose -f infra/docker-compose.dev.yml up -d

# 3. 初始化数据库
cd apps/api
alembic upgrade head

# 4. 启动 API 服务
python -m app.main

# 5. 启动前端（新终端）
cd apps/web
npm install
npm run dev
```

### 2. 部署脚本使用

```bash
# 构建本地镜像
chmod +x scripts/deploy/aliyun-deploy.sh
./scripts/deploy/aliyun-deploy.sh build

# 启动本地开发环境
./scripts/deploy/aliyun-deploy.sh dev

# 准备部署包
./scripts/deploy/aliyun-deploy.sh package
```

---

## 阿里云服务器准备

### 1. 购买资源（参考 `aliyun-resource-list.md`）

必购清单：
- ☑ 轻量应用服务器 2核4G（新用户约 ¥600/年）
- ☑ 日志服务 SLS（按量付费，约 ¥7/月）
- ☑ 域名（.com 约 ¥60/年）

### 2. 服务器初始化

```bash
# 1. 上传部署脚本
scp -r scripts/deploy root@your-server-ip:/tmp/

# 2. 登录服务器
ssh root@your-server-ip

# 3. 运行初始化脚本
chmod +x /tmp/deploy/setup-server.sh
/tmp/deploy/setup-server.sh
```

该脚本会自动安装：
- Docker + Docker Compose
- 系统优化配置
- 防火墙规则
- 定时备份任务

### 3. 配置应用

```bash
cd /opt/maneki

# 复制环境变量模板
cp .env.example .env

# 编辑配置（必须修改的项）
vim .env
```

关键配置项：
```ini
# 生产环境
APP_ENV=aliyun
DEBUG=false
SECRET_KEY=your-random-secret-key-here

# 数据库
DATABASE_URL=postgresql+asyncpg://stock:your-password@postgres:5432/stock_analysis

# 阿里云 SLS 日志
SLS_PROJECT=maneki-logs
SLS_LOGSTORE=maneki-api
SLS_ENDPOINT=cn-hangzhou.log.aliyuncs.com

# 微信登录（如需要）
WECHAT_MP_APP_ID=your-app-id
WECHAT_MP_APP_SECRET=your-app-secret
```

### 4. 启动服务

```bash
# 拉取镜像并启动
docker-compose up -d

# 查看日志
docker-compose logs -f api

# 健康检查
curl http://localhost:8000/health
```

---

## CI/CD 配置

### GitHub Secrets 配置

在 GitHub 仓库设置中添加以下 Secrets：

| Secret | 说明 | 获取方式 |
|--------|------|---------|
| `ALICLOUD_USERNAME` | 阿里云账号 | 阿里云控制台 -> 右上角头像 |
| `ALICLOUD_PASSWORD` | 阿里云密码或 AccessKey | 容器镜像服务 -> 访问凭证 |
| `ALIYUN_STAGING_HOST` | 测试服务器 IP | ECS 控制台 |
| `ALIYUN_PROD_HOST` | 生产服务器 IP | ECS 控制台 |
| `ALIYUN_USER` | SSH 用户名 | 通常为 `root` |
| `ALIYUN_SSH_KEY` | SSH 私钥 | `cat ~/.ssh/id_rsa` |
| `SLACK_WEBHOOK_URL` | Slack 通知（可选） | Slack Apps |

### 阿里云 ACR 配置

1. 登录阿里云控制台
2. 进入「容器镜像服务 ACR」
3. 创建命名空间（如 `maneki`）
4. 设置访问凭证（固定密码或临时 Token）

---

## GitHub Actions 部署

### 工作流说明

| 文件 | 触发条件 | 功能 |
|------|----------|------|
| `ci.yml` | Push / PR | 代码检查、测试、构建镜像 |
| `deploy.yml` | Push main / tag | 部署到测试/生产环境 |

### 部署流程

```
代码推送
    │
    ▼
┌─────────────┐
│  CI 检查    │  <-- lint, test, build
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 构建镜像    │  --> 推送到 ACR
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 部署服务器  │  <-- SSH 远程执行
└─────────────┘
```

### 手动触发部署

```bash
# 测试环境
git push origin main

# 生产环境（打 tag）
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

或在 GitHub Actions 页面点击「Run workflow」手动触发。

---

## 阿里云效部署（备选）

如果 GitHub Actions 访问不稳定，可使用阿里云效：

### 1. 代码迁移

```bash
# 在阿里云效创建 Codeup 仓库
git remote add codeup https://codeup.aliyun.com/your-org/maneki.git
git push codeup main
```

### 2. 创建流水线

在阿里云效 -> 流水线 -> 新建流水线，选择「Python 应用 Docker 部署」模板

### 3. 流水线配置

```yaml
# 示例流水线配置
stages:
  build:
    steps:
      - step: "构建镜像"
        type: "docker"
        commands:
          - docker build -t $ACR_REGISTRY/$NAMESPACE/maneki-api:$BUILD_NUMBER apps/api/
          - docker push $ACR_REGISTRY/$NAMESPACE/maneki-api:$BUILD_NUMBER

  deploy:
    steps:
      - step: "部署到 ECS"
        type: "script"
        host: "$PROD_HOST"
        commands:
          - cd /opt/maneki
          - docker-compose pull
          - docker-compose up -d
```

---

## 数据备份

### 自动备份

服务器初始化时已配置定时任务：
```bash
# 每天凌晨 3 点自动备份
crontab -l
# 0 3 * * * /opt/maneki/backup.sh >> /var/log/maneki-backup.log 2>&1
```

### 手动备份

```bash
cd /opt/maneki

# 创建备份
./backup.sh backup

# 上传到 OSS
OSS_BUCKET=my-bucket ./backup.sh upload

# 查看备份列表
./backup.sh list

# 恢复备份
./backup.sh restore maneki_backup_20240411_030000.tar.gz
```

---

## 监控与日志

### 1. SLS 日志查询

登录阿里云控制台 -> 日志服务 -> 查询分析

常用查询：
```sql
-- 查询所有错误
level: ERROR

-- 查询慢请求
duration_ms > 1000

-- 查询特定 API
path: "/api/v1/signals/*"

-- 查询特定用户
user_id: "12345"
```

### 2. 告警配置

在 SLS 中创建告警规则：
- 错误率 > 1% 时发送通知
- 5xx 错误数 > 10/分钟时发送通知
- 慢请求比例 > 5% 时发送通知

### 3. 系统监控

```bash
# 查看容器状态
docker-compose ps

# 查看资源使用
docker stats

# 查看系统资源
df -h
free -h
```

---

## 常见问题

### Q1: 容器无法启动

```bash
# 查看日志
docker-compose logs api

# 常见原因
1. 数据库连接失败 -> 检查 DATABASE_URL
2. 端口被占用 -> netstat -tlnp | grep 8000
3. 内存不足 -> free -h
```

### Q2: 镜像拉取失败

```bash
# 登录阿里云 ACR
docker login --username=your-username registry.cn-hangzhou.aliyuncs.com

# 检查镜像标签
docker pull registry.cn-hangzhou.aliyuncs.com/your-ns/maneki-api:latest
```

### Q3: 日志未采集到 SLS

```bash
# 检查 Logtail 状态
sudo /etc/init.d/ilogtaild status

# 检查日志输出
docker-compose logs api | head

# 检查 JSON 格式是否正确
```

### Q4: 部署后 502 错误

```bash
# 检查服务健康状态
curl http://localhost:8000/health

# 检查 Nginx 配置
docker-compose exec nginx nginx -t

# 查看 Nginx 错误日志
docker-compose logs nginx
```

---

## 安全建议

1. **修改默认密码**：所有数据库、Redis、管理后台密码
2. **配置 HTTPS**：使用阿里云免费 SSL 证书
3. **开启防火墙**：仅开放 80/443/22 端口
4. **定期更新**：`docker-compose pull && docker-compose up -d`
5. **备份验证**：定期测试备份恢复流程

---

## 相关文档

- [阿里云资源清单](./aliyun-resource-list.md)
- [架构设计文档](./architecture.md)
- [API 文档](./api.md)

---

*文档版本: v1.0*
*更新日期: 2026-04-11*
