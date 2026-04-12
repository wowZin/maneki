#!/bin/bash
# 健康检查脚本
# 用于监控系统健康状态

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查的服务
API_URL="http://localhost:8080/health"
DATA_SERVICE_URL="http://localhost:8001/health"
NGINX_URL="http://localhost/health"

# 发送告警（支持 Slack、钉钉等）
send_alert() {
    local service=$1
    local status=$2
    local message="⚠️ Maneki 服务告警: $service 状态异常 - $status"

    echo -e "${RED}$message${NC}"

    # Slack 告警（如果配置了 SLACK_WEBHOOK_URL）
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
}

# 检查 HTTP 服务
check_http() {
    local name=$1
    local url=$2

    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name 正常${NC}"
        return 0
    else
        echo -e "${RED}✗ $name 异常${NC}"
        send_alert "$name" "无法访问"
        return 1
    fi
}

# 检查 Docker 容器
check_container() {
    local name=$1

    if docker ps --format "{{.Names}}" | grep -q "^${name}$"; then
        echo -e "${GREEN}✓ 容器 $name 运行中${NC}"
        return 0
    else
        echo -e "${RED}✗ 容器 $name 未运行${NC}"
        send_alert "容器:$name" "已停止"
        return 1
    fi
}

# 检查磁盘空间
check_disk() {
    local threshold=80
    local usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

    if [ "$usage" -gt "$threshold" ]; then
        echo -e "${YELLOW}⚠ 磁盘空间不足: ${usage}%${NC}"
        send_alert "磁盘空间" "使用率 ${usage}%"
        return 1
    else
        echo -e "${GREEN}✓ 磁盘空间充足: ${usage}%${NC}"
        return 0
    fi
}

# 检查内存使用
check_memory() {
    local threshold=90
    local usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')

    if [ "$usage" -gt "$threshold" ]; then
        echo -e "${YELLOW}⚠ 内存使用率高: ${usage}%${NC}"
        send_alert "内存" "使用率 ${usage}%"
        return 1
    else
        echo -e "${GREEN}✓ 内存使用正常: ${usage}%${NC}"
        return 0
    fi
}

# 主检查流程
main() {
    echo "========================================"
    echo "Maneki 健康检查 - $(date)"
    echo "========================================"
    echo ""

    local failed=0

    # 检查容器状态
    echo "容器状态:"
    check_container "maneki_api" || ((failed++))
    check_container "maneki_data_service" || ((failed++))
    check_container "maneki_postgres" || ((failed++))
    check_container "maneki_redis" || ((failed++))
    check_container "maneki_nginx" || ((failed++))
    echo ""

    # 检查 HTTP 服务
    echo "服务健康:"
    check_http "API" "$API_URL" || ((failed++))
    check_http "Data Service" "$DATA_SERVICE_URL" || ((failed++))
    check_http "Nginx" "$NGINX_URL" || ((failed++))
    echo ""

    # 检查资源使用
    echo "资源使用:"
    check_disk || ((failed++))
    check_memory || ((failed++))
    echo ""

    # 数据库连接检查
    echo "数据库:"
    if docker exec maneki_postgres pg_isready -U stock > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL 正常${NC}"
    else
        echo -e "${RED}✗ PostgreSQL 异常${NC}"
        send_alert "PostgreSQL" "连接失败"
        ((failed++))
    fi

    if docker exec maneki_redis redis-cli ping | grep -q "PONG"; then
        echo -e "${GREEN}✓ Redis 正常${NC}"
    else
        echo -e "${RED}✗ Redis 异常${NC}"
        send_alert "Redis" "连接失败"
        ((failed++))
    fi
    echo ""

    # 总结
    echo "========================================"
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}所有检查通过 ✓${NC}"
        exit 0
    else
        echo -e "${RED}发现 $failed 个问题 ✗${NC}"
        exit 1
    fi
}

# 执行检查
main "$@"
