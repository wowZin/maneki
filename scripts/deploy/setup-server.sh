#!/bin/bash
# ============================================
# 服务器初始化脚本
# 在阿里云 ECS/轻量服务器上运行
# ============================================

set -e

APP_NAME="maneki"
APP_DIR="/opt/${APP_NAME}"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查是否为 root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "请使用 root 用户运行此脚本"
        exit 1
    fi
}

# 安装 Docker
install_docker() {
    info "安装 Docker..."

    if command -v docker &> /dev/null; then
        success "Docker 已安装: $(docker --version)"
        return 0
    fi

    # 使用阿里云镜像源安装 Docker
    curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun

    # 配置 Docker 阿里云镜像加速
    mkdir -p /etc/docker
    cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

    # 启动 Docker
    systemctl daemon-reload
    systemctl restart docker
    systemctl enable docker

    success "Docker 安装完成"
}

# 安装 Docker Compose
install_docker_compose() {
    info "安装 Docker Compose..."

    if command -v docker-compose &> /dev/null; then
        success "Docker Compose 已安装: $(docker-compose --version)"
        return 0
    fi

    # 安装 docker-compose
    local compose_version="2.24.0"
    curl -L "https://github.com/docker/compose/releases/download/v${compose_version}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

    success "Docker Compose 安装完成"
}

# 安装阿里云 Logtail（日志采集）
install_logtail() {
    info "安装阿里云 Logtail..."

    if [[ -f "/usr/local/ilogtail/ilogtail" ]]; then
        success "Logtail 已安装"
        return 0
    fi

    # 下载并安装 Logtail
    # 注意：需要替换为实际的 Project 和地域
    local region="cn-hangzhou"

    wget "https://ilogtail-release-${region}.oss-${region}-internal.aliyuncs.com/linux64/latest/ilogtail.sh" -O /tmp/ilogtail.sh
    chmod +x /tmp/ilogtail.sh
    sh /tmp/ilogtail.sh install auto

    success "Logtail 安装完成"
    warn "请登录阿里云控制台配置 Logtail 采集规则"
}

# 创建应用目录
setup_app_directory() {
    info "创建应用目录..."

    mkdir -p "${APP_DIR}"
    mkdir -p "${APP_DIR}/data/postgres"
    mkdir -p "${APP_DIR}/data/redis"
    mkdir -p "${APP_DIR}/logs"
    mkdir -p "${APP_DIR}/backups"

    # 创建启动脚本
    cat > "${APP_DIR}/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
docker-compose up -d
EOF
    chmod +x "${APP_DIR}/start.sh"

    # 创建停止脚本
    cat > "${APP_DIR}/stop.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
docker-compose down
EOF
    chmod +x "${APP_DIR}/stop.sh"

    # 创建查看日志脚本
    cat > "${APP_DIR}/logs.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
docker-compose logs -f --tail=100
EOF
    chmod +x "${APP_DIR}/logs.sh"

    success "应用目录创建完成: ${APP_DIR}"
}

# 配置防火墙
configure_firewall() {
    info "配置防火墙..."

    # 开放常用端口
    if command -v firewall-cmd &> /dev/null; then
        # CentOS/RHEL
        firewall-cmd --permanent --add-port=80/tcp
        firewall-cmd --permanent --add-port=443/tcp
        firewall-cmd --permanent --add-port=8000/tcp
        firewall-cmd --reload
    elif command -v ufw &> /dev/null; then
        # Ubuntu
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 8000/tcp
        ufw reload
    else
        warn "未检测到防火墙工具，请手动配置"
    fi

    success "防火墙配置完成"
}

# 配置系统优化
system_optimization() {
    info "系统优化..."

    # 配置系统参数
    cat >> /etc/sysctl.conf << 'EOF'

# Maneki 优化配置
# 增加文件描述符限制
fs.file-max = 65535

# 网络优化
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
EOF

    sysctl -p

    # 配置 ulimit
    cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 65535
* hard nofile 65535
* soft nproc 65535
* hard nproc 65535
EOF

    success "系统优化完成"
}

# 创建定时备份任务
setup_backup_cron() {
    info "配置定时备份..."

    # 创建备份目录
    mkdir -p /opt/backups

    # 添加定时任务（每天凌晨 3 点备份）
    (crontab -l 2>/dev/null || true; echo "0 3 * * * ${APP_DIR}/backup.sh >> /var/log/maneki-backup.log 2>&1") | crontab -

    success "定时备份配置完成"
}

# 显示部署后说明
show_post_install() {
    cat << EOF

${GREEN}========================================${NC}
${GREEN}    Maneki 服务器初始化完成！${NC}
${GREEN}========================================${NC}

${YELLOW}下一步操作：${NC}

1. 配置环境变量
   cp ${APP_DIR}/.env.example ${APP_DIR}/.env
   vim ${APP_DIR}/.env

2. 编辑 docker-compose.yml 配置镜像地址

3. 启动服务
   cd ${APP_DIR}
   docker-compose up -d

4. 查看日志
   docker-compose logs -f

5. 配置阿里云 SLS 日志采集
   - 登录阿里云控制台
   - 进入日志服务 SLS
   - 创建 Project 和 Logstore
   - 安装 Logtail 并配置机器组
   - 创建采集配置（正则匹配 JSON 日志）

${YELLOW}常用命令：${NC}
   ${APP_DIR}/start.sh    # 启动服务
   ${APP_DIR}/stop.sh     # 停止服务
   ${APP_DIR}/logs.sh     # 查看日志
   ${APP_DIR}/backup.sh   # 手动备份

${YELLOW}访问地址：${NC}
   API 文档: http://$(curl -s ifconfig.me):8000/docs
   健康检查: http://$(curl -s ifconfig.me):8000/health

EOF
}

# 主函数
main() {
    echo "========================================"
    echo "  Maneki 服务器初始化脚本"
    echo "========================================"

    check_root
    install_docker
    install_docker_compose
    setup_app_directory
    configure_firewall
    system_optimization
    setup_backup_cron

    # 可选：安装 Logtail（需要用户确认）
    read -p "是否安装阿里云 Logtail？需要先在控制台创建 Project [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_logtail
    fi

    show_post_install

    success "服务器初始化完成！"
}

main "$@"
