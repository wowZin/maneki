# Maneki 生产环境部署指南

## 目录结构

```
infra/
├── docker-compose.prod.yml    # 生产环境 Docker Compose 配置
├── docker-compose.dev.yml     # 开发环境 Docker Compose 配置
├── deploy.sh                  # 部署脚本
├── nginx/                     # Nginx 配置
│   ├── nginx.conf
│   └── conf.d/
│       └── default.conf
├── backups/                   # 数据库备份目录
├── data/                      # 数据持久化目录
│   └── offline/              # 离线数据存储
├── logs/                      # 日志目录
│   ├── api/
│   ├── data-service/
│   └── nginx/
└── ssl/                       # SSL 证书目录
```

## 快速开始

### 1. 初始化环境

```bash
cd infra
./deploy.sh init
```

### 2. 配置环境变量

编辑 `.env` 文件，设置以下必填项：

```bash
# 数据库配置
DB_USER=stock
DB_PASSWORD=YourStrongPassword123!
DB_NAME=stock_analysis

# Redis 配置
REDIS_PASSWORD=YourRedisPassword456!

# 应用密钥（生成命令: openssl rand -hex 32）
SECRET_KEY=your-generated-secret-key

# CORS 允许的域名
CORS_ORIGINS=https://your-domain.com
```

### 3. 启动服务

```bash
./deploy.sh start
```

### 4. 检查状态

```bash
./deploy.sh status
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `./deploy.sh init` | 初始化环境 |
| `./deploy.sh start` | 启动所有服务 |
| `./deploy.sh stop` | 停止所有服务 |
| `./deploy.sh restart` | 重启服务 |
| `./deploy.sh update` | 更新并重新部署 |
| `./deploy.sh backup` | 备份数据库 |
| `./deploy.sh logs` | 查看所有日志 |
| `./deploy.sh logs api` | 查看 API 日志 |
| `./deploy.sh status` | 查看服务状态 |
| `./deploy.sh clean` | 清理未使用的资源 |

## 服务访问

| 服务 | 地址 | 说明 |
|------|------|------|
| API | http://localhost:8080 | Go API 服务 |
| Data Service | http://localhost:8001 | 数据服务（仅本地访问） |
| Nginx | http://localhost | 反向代理入口 |

## 生产环境优化建议

### 1. SSL/HTTPS 配置

1. 获取 SSL 证书（推荐使用 Let's Encrypt）
2. 将证书放入 `ssl/` 目录
3. 取消 `nginx/conf.d/default.conf` 中 HTTPS 配置的注释

### 2. 数据库优化

编辑 `docker-compose.prod.yml` 调整 PostgreSQL 配置：

```yaml
postgres:
  # ... 其他配置
  command: >
    postgres
    -c shared_buffers=2GB
    -c effective_cache_size=4GB
    -c maintenance_work_mem=512MB
```

### 3. 日志收集

推荐使用 ELK Stack 或 Loki 收集日志：

```yaml
# 在 docker-compose.prod.yml 中添加
logging:
  driver: "fluentd"
  options:
    fluentd-address: localhost:24224
    tag: docker.{{.Name}}
```

### 4. 监控告警

使用 Prometheus + Grafana 监控：

```bash
# 添加监控服务到 docker-compose.prod.yml
  prometheus:
    image: prom/prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
```

## 备份策略

### 自动备份

添加定时任务：

```bash
# 每天凌晨 2 点备份
0 2 * * * cd /path/to/infra && ./deploy.sh backup >> /var/log/maneki-backup.log 2>&1
```

### 手动备份

```bash
./deploy.sh backup
```

备份文件保存在 `backups/` 目录，保留最近 7 天。

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker-compose -f docker-compose.prod.yml logs

# 检查资源使用
docker stats

# 重启服务
./deploy.sh restart
```

### 数据库连接失败

```bash
# 检查数据库状态
docker exec maneki_postgres pg_isready

# 查看数据库日志
docker logs maneki_postgres
```

### 内存不足

```bash
# 查看内存使用
free -h

# 清理 Docker 缓存
docker system prune -a
```

## 更新部署

```bash
# 1. 进入目录
cd infra

# 2. 更新代码
git pull origin main

# 3. 重新部署（会自动备份数据库）
./deploy.sh update
```

## 安全建议

1. **修改默认密码**：务必修改 `DB_PASSWORD`、`REDIS_PASSWORD`、`SECRET_KEY`
2. **防火墙配置**：只开放 80/443 端口，数据库不暴露公网
3. **定期更新**：及时更新基础镜像和依赖
4. **日志审计**：定期检查日志文件
5. **SSL 证书**：生产环境必须使用 HTTPS

## 资源需求

| 服务 | 最低配置 | 推荐配置 |
|------|---------|---------|
| PostgreSQL | 2GB RAM, 1 CPU | 4GB RAM, 2 CPU |
| Redis | 512MB RAM | 1GB RAM |
| API | 512MB RAM, 0.5 CPU | 1GB RAM, 1 CPU |
| Data Service | 1GB RAM, 0.5 CPU | 2GB RAM, 1 CPU |
| **总计** | **4GB RAM, 2 CPU** | **8GB RAM, 4 CPU** |

## 支持的系统

- Ubuntu 20.04/22.04
- CentOS 7/8
- Debian 11/12
- macOS (开发测试)
