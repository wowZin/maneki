# Maneki 生产环境安装指南

## 系统要求

- **操作系统**: Ubuntu 20.04/22.04 LTS, CentOS 7/8, Debian 11/12
- **内存**: 最低 4GB，推荐 8GB
- **CPU**: 最低 2 核，推荐 4 核
- **磁盘**: 最低 50GB，推荐 100GB+
- **网络**: 公网 IP，开放 80/443 端口

## 安装步骤

### 1. 安装 Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker-compose --version
```

### 2. 创建应用目录

```bash
sudo mkdir -p /opt/maneki
cd /opt/maneki
sudo chown $USER:$USER /opt/maneki
```

### 3. 克隆代码

```bash
git clone https://github.com/your-org/maneki.git .
cd infra
```

### 4. 初始化环境

```bash
./deploy.sh init
```

### 5. 配置环境变量

编辑 `.env` 文件：

```bash
# 必须修改的配置
DB_PASSWORD=YourStrongPassword123!
REDIS_PASSWORD=YourRedisPassword456!
SECRET_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=https://your-domain.com
```

### 6. 启动服务

```bash
./deploy.sh start
```

### 7. 配置系统服务（可选）

```bash
# 复制 systemd 服务文件
sudo cp systemd/maneki.service /etc/systemd/system/

# 启用开机启动
sudo systemctl enable maneki

# 管理服务
sudo systemctl start maneki   # 启动
sudo systemctl stop maneki    # 停止
sudo systemctl restart maneki # 重启
sudo systemctl status maneki  # 查看状态
```

### 8. 配置 Nginx + SSL

#### 使用 Let's Encrypt（推荐）

```bash
# 安装 certbot
sudo apt install certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com

# 复制证书到项目目录
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem

# 修改 Nginx 配置启用 HTTPS
vi nginx/conf.d/default.conf
```

#### 自动续期

```bash
# 添加定时任务
echo "0 2 * * * certbot renew --quiet && cp /etc/letsencrypt/live/your-domain.com/*.pem /opt/maneki/infra/ssl/ && docker exec maneki_nginx nginx -s reload" | sudo crontab -
```

## 配置防火墙

```bash
# Ubuntu (UFW)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# CentOS (FirewallD)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 设置监控

### 1. 添加定时健康检查

```bash
# 编辑 crontab
crontab -e

# 添加以下行
*/5 * * * * cd /opt/maneki/infra && ./health-check.sh > /dev/null 2>&1
```

### 2. 配置日志轮转

```bash
sudo tee /etc/logrotate.d/maneki << 'EOF'
/opt/maneki/infra/logs/*/ *.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
    sharedscripts
    postrotate
        /usr/bin/docker exec maneki_nginx nginx -s reload 2>/dev/null || true
    endscript
}
EOF
```

### 3. 自动备份

```bash
# 每天凌晨 2 点备份
0 2 * * * cd /opt/maneki/infra && ./deploy.sh backup >> /var/log/maneki-backup.log 2>&1
```

## 验证安装

```bash
# 检查所有服务状态
./deploy.sh status

# 查看日志
./deploy.sh logs

# 运行健康检查
./health-check.sh

# 测试 API
curl http://localhost:8080/health
curl http://localhost:8001/health
```

## 故障排除

### 服务无法启动

```bash
# 查看详细日志
docker-compose -f docker-compose.prod.yml logs

# 检查端口占用
sudo netstat -tlnp | grep 8080
sudo netstat -tlnp | grep 8001

# 重启所有服务
./deploy.sh restart
```

### 数据库连接失败

```bash
# 检查数据库容器
docker logs maneki_postgres

# 手动连接测试
docker exec -it maneki_postgres psql -U stock -d stock_analysis
```

### 磁盘空间不足

```bash
# 查看磁盘使用
df -h

# 清理 Docker
docker system prune -a

# 清理旧备份
find backups/ -name "*.sql.gz" -mtime +30 -delete
```

## 性能调优

### 数据库优化

编辑 `docker-compose.prod.yml`：

```yaml
postgres:
  command: >
    postgres
    -c shared_buffers=2GB
    -c effective_cache_size=4GB
    -c maintenance_work_mem=512MB
    -c work_mem=32MB
    -c max_connections=200
```

### 系统参数优化

```bash
# 编辑 /etc/sysctl.conf
sudo tee -a /etc/sysctl.conf << 'EOF'
# 网络优化
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_tw_reuse = 1

# 内存优化
vm.swappiness = 10
vm.dirty_ratio = 40
vm.dirty_background_ratio = 10
EOF

sudo sysctl -p
```

## 安全加固

### 1. 禁用 root 登录

```bash
# 编辑 SSH 配置
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

### 2. 配置 Fail2Ban

```bash
sudo apt install fail2ban

sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
EOF

sudo systemctl restart fail2ban
```

### 3. 定期更新

```bash
# 自动安全更新
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

## 升级指南

### 小版本更新

```bash
cd /opt/maneki
git pull origin main
cd infra
./deploy.sh update
```

### 大版本更新

1. 阅读 CHANGELOG
2. 备份数据：`./deploy.sh backup`
3. 更新代码：`git pull origin main`
4. 重新部署：`./deploy.sh update`
5. 验证服务：`./health-check.sh`

## 卸载

```bash
# 停止服务
cd /opt/maneki/infra
./deploy.sh stop

# 删除容器和数据（谨慎操作！）
docker-compose -f docker-compose.prod.yml down -v

# 删除目录
sudo rm -rf /opt/maneki

# 删除系统服务
sudo systemctl disable maneki
sudo rm /etc/systemd/system/maneki.service
```

## 获取帮助

- GitHub Issues: https://github.com/your-org/maneki/issues
- 文档: https://docs.maneki.app
- 社区: https://discord.gg/maneki
