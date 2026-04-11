#!/bin/bash
# ============================================
# Maneki 数据备份脚本
# 支持本地备份和阿里云 OSS 上传
# ============================================

set -e

APP_NAME="maneki"
APP_DIR="/opt/${APP_NAME}"
BACKUP_DIR="${APP_DIR}/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="${APP_NAME}_backup_${DATE}"

# 阿里云 OSS 配置（可选）
OSS_BUCKET="${OSS_BUCKET:-}"
OSS_ENDPOINT="${OSS_ENDPOINT:-oss-cn-hangzhou.aliyuncs.com}"

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

# 创建备份
create_backup() {
    info "开始备份..."

    local backup_path="${BACKUP_DIR}/${BACKUP_NAME}"
    mkdir -p "$backup_path"

    # 1. 备份数据库
    info "备份 PostgreSQL 数据库..."
    cd "${APP_DIR}"
    docker-compose exec -T postgres pg_dumpall -c -U postgres > "${backup_path}/database.sql" 2>/dev/null || {
        warn "数据库备份失败，尝试其他方式..."
        docker-compose exec -T postgres pg_dump -U postgres stock_analysis > "${backup_path}/database.sql" 2>/dev/null || error "数据库备份失败"
    }

    # 2. 备份 Redis
    info "备份 Redis..."
    docker-compose exec -T redis redis-cli BGSAVE > /dev/null 2>&1 || true
    # 等待 BGSAVE 完成
    sleep 2
    docker cp "${APP_NAME}_redis_1:/data/dump.rdb" "${backup_path}/redis.rdb" 2>/dev/null || warn "Redis 备份失败"

    # 3. 备份配置文件
    info "备份配置文件..."
    cp "${APP_DIR}/.env" "${backup_path}/.env" 2>/dev/null || warn "环境变量文件不存在"
    cp "${APP_DIR}/docker-compose.yml" "${backup_path}/" 2>/dev/null || warn "docker-compose.yml 不存在"

    # 4. 打包压缩
    info "打包备份..."
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
    rm -rf "$backup_path"

    local backup_size=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
    success "备份完成: ${BACKUP_NAME}.tar.gz (${backup_size})"

    # 清理旧备份（保留最近 7 天）
    info "清理旧备份..."
    find "$BACKUP_DIR" -name "${APP_NAME}_backup_*.tar.gz" -mtime +7 -delete
    local remaining=$(find "$BACKUP_DIR" -name "${APP_NAME}_backup_*.tar.gz" | wc -l)
    info "保留备份数量: $remaining"
}

# 上传到阿里云 OSS
upload_to_oss() {
    if [[ -z "$OSS_BUCKET" ]]; then
        warn "未配置 OSS_BUCKET，跳过上传"
        return 0
    fi

    info "上传到阿里云 OSS..."

    # 检查 ossutil
    if ! command -v ossutil &> /dev/null; then
        warn "ossutil 未安装，尝试安装..."
        wget -q "https://gosspublic.alicdn.com/ossutil/1.7.14/ossutil64" -O /usr/local/bin/ossutil
        chmod +x /usr/local/bin/ossutil
    fi

    # 配置 ossutil（首次运行需要配置）
    if [[ ! -f "${HOME}/.ossutilconfig" ]]; then
        warn "请先配置 ossutil: ossutil config"
        return 1
    fi

    local backup_file="${BACKUP_NAME}.tar.gz"
    ossutil cp "${BACKUP_DIR}/${backup_file}" "oss://${OSS_BUCKET}/backups/${backup_file}" --force

    success "上传完成: oss://${OSS_BUCKET}/backups/${backup_file}"
}

# 恢复备份
restore_backup() {
    local backup_file="$1"

    if [[ -z "$backup_file" ]]; then
        error "请指定备份文件"
        echo "可用备份:"
        ls -la "${BACKUP_DIR}"/*.tar.gz 2>/dev/null || echo "无备份文件"
        exit 1
    fi

    if [[ ! -f "$backup_file" ]]; then
        backup_file="${BACKUP_DIR}/${backup_file}"
    fi

    if [[ ! -f "$backup_file" ]]; then
        error "备份文件不存在: $backup_file"
        exit 1
    fi

    info "准备恢复备份: $backup_file"
    read -p "这将覆盖现有数据，确认继续？[y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "取消恢复"
        exit 0
    fi

    # 停止服务
    info "停止服务..."
    cd "${APP_DIR}"
    docker-compose down

    # 解压备份
    local temp_dir="/tmp/maneki_restore_$$"
    mkdir -p "$temp_dir"
    tar -xzf "$backup_file" -C "$temp_dir"

    local backup_name=$(basename "$backup_file" .tar.gz)

    # 恢复数据库
    info "恢复数据库..."
    docker-compose up -d postgres
    sleep 5
    docker-compose exec -T postgres psql -U postgres < "${temp_dir}/${backup_name}/database.sql"

    # 恢复 Redis
    if [[ -f "${temp_dir}/${backup_name}/redis.rdb" ]]; then
        info "恢复 Redis..."
        docker cp "${temp_dir}/${backup_name}/redis.rdb" "${APP_NAME}_redis_1:/data/dump.rdb"
    fi

    # 恢复配置
    if [[ -f "${temp_dir}/${backup_name}/.env" ]]; then
        cp "${temp_dir}/${backup_name}/.env" "${APP_DIR}/.env"
    fi

    # 清理
    rm -rf "$temp_dir"

    # 启动服务
    info "启动服务..."
    docker-compose up -d

    success "恢复完成"
}

# 列出备份
list_backups() {
    info "备份列表:"
    echo "----------------------------------------"
    printf "%-30s %-10s %-20s\n" "文件名" "大小" "修改时间"
    echo "----------------------------------------"

    for f in "${BACKUP_DIR}"/*.tar.gz; do
        if [[ -f "$f" ]]; then
            local name=$(basename "$f")
            local size=$(du -h "$f" | cut -f1)
            local mtime=$(stat -c %y "$f" 2>/dev/null || stat -f %Sm "$f" 2>/dev/null | head -1)
            printf "%-30s %-10s %-20s\n" "$name" "$size" "$mtime"
        fi
    done

    echo "----------------------------------------"
}

# 显示帮助
show_help() {
    cat << EOF
Maneki 数据备份脚本

用法: $0 [命令] [选项]

命令:
    backup      创建新备份
    upload      创建备份并上传到 OSS
    restore     恢复指定备份
    list        列出所有备份
    help        显示帮助

环境变量:
    OSS_BUCKET      阿里云 OSS Bucket 名称
    OSS_ENDPOINT    OSS 端点（默认: oss-cn-hangzhou.aliyuncs.com）

示例:
    # 创建备份
    $0 backup

    # 创建并上传
    OSS_BUCKET=my-bucket $0 upload

    # 恢复备份
    $0 restore maneki_backup_20240411_030000.tar.gz

    # 列出备份
    $0 list

EOF
}

# 主函数
main() {
    local command="${1:-backup}"

    # 确保备份目录存在
    mkdir -p "$BACKUP_DIR"

    case "$command" in
        backup)
            create_backup
            ;;
        upload)
            create_backup
            upload_to_oss
            ;;
        restore)
            restore_backup "$2"
            ;;
        list)
            list_backups
            ;;
        help|*)
            show_help
            ;;
    esac
}

main "$@"
