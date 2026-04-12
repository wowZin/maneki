#!/bin/bash
# Maneki 生产环境部署脚本
# 使用方法: ./deploy.sh [init|start|stop|restart|update|backup|logs]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
BACKUP_DIR="./backups"
LOGS_DIR="./logs"

# 帮助信息
show_help() {
    echo "Maneki 生产环境部署脚本"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  init        初始化环境（创建目录、配置文件）"
    echo "  start       启动所有服务"
    echo "  stop        停止所有服务"
    echo "  restart     重启所有服务"
    echo "  update      更新并重新部署"
    echo "  backup      备份数据库"
    echo "  logs        查看日志"
    echo "  status      查看服务状态"
    echo "  clean       清理未使用的镜像和卷"
    echo ""
    echo "示例:"
    echo "  $0 init     # 首次部署"
    echo "  $0 update   # 更新代码后重新部署"
}

# 初始化环境
init() {
    echo -e "${GREEN}初始化生产环境...${NC}"

    # 创建必要的目录
    mkdir -p {backups,data/offline,logs/{api,data-service,nginx},ssl}

    # 创建环境配置文件（如果不存在）
    if [ ! -f "$ENV_FILE" ]; then
        cat > "$ENV_FILE" << 'EOF'
# Maneki 生产环境配置

# 数据库配置
DB_USER=stock
DB_PASSWORD=ChangeMeToStrongPassword123!
DB_NAME=stock_analysis

# Redis 配置
REDIS_PASSWORD=ChangeMeToStrongPassword456!

# 应用密钥（必须修改！）
SECRET_KEY=YourSuperSecretKeyHereChangeThisInProduction

# CORS 配置（允许访问的域名，逗号分隔）
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
EOF
        echo -e "${YELLOW}已创建 $ENV_FILE 文件，请修改配置后再启动服务${NC}"
    fi

    # 设置目录权限
    chmod 600 "$ENV_FILE" 2>/dev/null || true

    echo -e "${GREEN}初始化完成！${NC}"
    echo -e "${YELLOW}提示: 请编辑 $ENV_FILE 文件设置正确的配置${NC}"
}

# 启动服务
start() {
    echo -e "${GREEN}启动服务...${NC}"

    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}错误: $ENV_FILE 文件不存在，请先运行: $0 init${NC}"
        exit 1
    fi

    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

    echo -e "${GREEN}服务已启动${NC}"
    echo "等待服务启动..."
    sleep 10

    # 检查服务状态
    check_status
}

# 停止服务
stop() {
    echo -e "${YELLOW}停止服务...${NC}"
    docker-compose -f "$COMPOSE_FILE" down
    echo -e "${GREEN}服务已停止${NC}"
}

# 重启服务
restart() {
    echo -e "${YELLOW}重启服务...${NC}"
    docker-compose -f "$COMPOSE_FILE" restart
    echo -e "${GREEN}服务已重启${NC}"
}

# 更新并重新部署
update() {
    echo -e "${GREEN}更新服务...${NC}"

    # 备份数据库
    backup

    # 拉取最新代码（如果在 git 仓库中）
    if [ -d ".git" ]; then
        echo "拉取最新代码..."
        git pull origin main || true
    fi

    # 重新构建并启动
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

    # 清理旧镜像
    docker image prune -f

    echo -e "${GREEN}更新完成！${NC}"
}

# 备份数据库
backup() {
    echo -e "${GREEN}备份数据库...${NC}"

    BACKUP_FILE="$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).sql"

    # 确保备份目录存在
    mkdir -p "$BACKUP_DIR"

    # 执行备份
    docker exec maneki_postgres pg_dump -U stock -d stock_analysis > "$BACKUP_FILE"

    # 压缩备份文件
    gzip "$BACKUP_FILE"

    # 保留最近 7 天的备份
    find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +7 -delete

    echo -e "${GREEN}备份完成: ${BACKUP_FILE}.gz${NC}"
}

# 查看日志
logs() {
    if [ -z "$2" ]; then
        echo "查看所有日志..."
        docker-compose -f "$COMPOSE_FILE" logs -f --tail=100
    else
        echo "查看 $2 日志..."
        docker-compose -f "$COMPOSE_FILE" logs -f --tail=100 "$2"
    fi
}

# 检查服务状态
status() {
    echo -e "${GREEN}服务状态:${NC}"
    docker-compose -f "$COMPOSE_FILE" ps

    echo ""
    echo -e "${GREEN}资源使用:${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

# 清理未使用的资源
clean() {
    echo -e "${YELLOW}清理未使用的资源...${NC}"
    docker system prune -f
    docker volume prune -f
    echo -e "${GREEN}清理完成${NC}"
}

# 主逻辑
case "${1:-help}" in
    init)
        init
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    update)
        update
        ;;
    backup)
        backup
        ;;
    logs)
        logs "$@"
        ;;
    status)
        status
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}未知命令: $1${NC}"
        show_help
        exit 1
        ;;
esac
