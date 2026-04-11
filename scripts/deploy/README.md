# Maneki 部署脚本说明

## 文件结构

```
scripts/deploy/
├── aliyun-deploy.sh    # 主部署脚本（本地使用）
├── setup-server.sh     # 服务器初始化脚本（在阿里云服务器上运行）
├── backup.sh           # 数据备份/恢复脚本
└── README.md           # 本文件
```

## 使用流程

### 1. 首次部署（新服务器）

```bash
# 步骤 1: 在阿里云控制台创建 ECS/轻量服务器
# 步骤 2: 配置安全组（开放 22, 80, 443, 8000 端口）
# 步骤 3: 连接服务器并初始化

ssh root@your-server-ip
curl -fsSL https://raw.githubusercontent.com/your-org/maneki/main/scripts/deploy/setup-server.sh | bash

# 步骤 4: 配置应用
cd /opt/maneki
cp .env.example .env
vim .env  # 修改配置

# 步骤 5: 启动服务
docker-compose up -d
```

### 2. 本地开发和构建

```bash
# 进入项目目录
cd /path/to/maneki

# 启动本地开发环境
./scripts/deploy/aliyun-deploy.sh dev

# 构建镜像
./scripts/deploy/aliyun-deploy.sh build

# 推送到阿里云 ACR
DOCKER_REGISTRY=registry.cn-hangzhou.aliyuncs.com \
NAMESPACE=your-namespace \
./scripts/deploy/aliyun-deploy.sh push
```

### 3. 远程部署（需要配置 SSH 密钥）

```bash
# 配置环境变量
export REMOTE_HOST=47.100.xxx.xxx
export REMOTE_USER=root
export SSH_KEY=~/.ssh/id_rsa

# 执行部署
./scripts/deploy/aliyun-deploy.sh deploy
```

### 4. 完整 CI/CD 流程

```bash
# 构建 + 推送 + 准备包 + 远程部署
REMOTE_HOST=47.100.xxx.xxx \
APP_VERSION=v1.0.0 \
./scripts/deploy/aliyun-deploy.sh all
```

## 备份管理

```bash
# 在服务器上执行
cd /opt/maneki

# 手动备份
./backup.sh backup

# 备份并上传到 OSS
OSS_BUCKET=my-bucket ./backup.sh upload

# 查看备份列表
./backup.sh list

# 恢复备份
./backup.sh restore maneki_backup_20240411_030000.tar.gz
```

## 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f api
docker-compose logs -f worker

# 重启服务
docker-compose restart api

# 更新镜像
docker-compose pull && docker-compose up -d

# 进入容器
docker-compose exec api sh

# 数据库备份
docker-compose exec postgres pg_dump -U stock stock_analysis > backup.sql

# 数据库恢复
docker-compose exec -T postgres psql -U stock stock_analysis < backup.sql
```

## 故障排查

### 服务无法启动

```bash
# 检查日志
docker-compose logs --tail=100 api

# 检查端口占用
netstat -tlnp | grep 8000

# 检查磁盘空间
df -h

# 检查内存使用
free -h
```

### 数据库连接失败

```bash
# 检查数据库容器
docker-compose ps postgres
docker-compose logs postgres

# 手动连接测试
docker-compose exec postgres psql -U stock -d stock_analysis
```

### 网络问题

```bash
# 检查网络
docker network ls
docker network inspect maneki-network

# 容器间连通性测试
docker-compose exec api ping postgres
docker-compose exec api ping redis
```

## 环境变量参考

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `APP_ENV` | 环境标识 | `aliyun` |
| `SECRET_KEY` | JWT 密钥 | 必填 |
| `DB_PASSWORD` | 数据库密码 | `stock123` |
| `RABBITMQ_PASSWORD` | MQ 密码 | `stock123` |
| `SLS_PROJECT` | SLS 项目名 | 空 |
| `DOCKER_REGISTRY` | 镜像仓库 | 阿里云 ACR |
| `NAMESPACE` | 镜像命名空间 | `your-namespace` |
| `APP_VERSION` | 应用版本 | `latest` |

## 安全建议

1. 修改所有默认密码
2. 使用 SSH 密钥而非密码登录
3. 配置阿里云安全组，仅开放必要端口
4. 启用阿里云云防火墙
5. 定期更新系统和镜像
6. 配置日志监控告警

## 相关文档

- [阿里云部署指南](../../docs/deployment-guide.md)
- [阿里云资源清单](../../docs/aliyun-resource-list.md)
