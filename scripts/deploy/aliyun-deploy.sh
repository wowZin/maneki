#!/bin/bash
# ============================================
# Maneki 阿里云部署脚本
# 支持 ECS/轻量应用服务器 一键部署
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
APP_NAME="maneki"
APP_VERSION="${APP_VERSION:-latest}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-registry.cn-hangzhou.aliyuncs.com}"
NAMESPACE="${NAMESPACE:-your-namespace}"
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_USER="${REMOTE_USER:-root}"
SSH_KEY="${SSH_KEY:-~/.ssh/id_rsa}"

# 打印彩色信息
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查依赖
check_dependencies() {
    info "检查依赖..."

    local deps=("docker" "docker-compose" "ssh" "scp")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error "缺少依赖: $dep"
            exit 1
        fi
    done

    success "依赖检查通过"
}

# 构建 Docker 镜像
build_images() {
    info "构建 Docker 镜像..."

    cd "$(dirname "$0")/../.."

    # 构建 API 镜像
    info "构建 API 镜像..."
    docker build -t "${APP_NAME}-api:${APP_VERSION}" -f apps/api/Dockerfile apps/api/

    # 构建 Web 镜像（如果需要）
    # info "构建 Web 镜像..."
    # docker build -t "${APP_NAME}-web:${APP_VERSION}" -f apps/web/Dockerfile apps/web/

    success "镜像构建完成"
}

# 推送镜像到阿里云 ACR
push_images() {
    info "推送镜像到阿里云 ACR..."

    # 登录阿里云（需要预先配置好 docker login）
    if ! docker info | grep -q "${DOCKER_REGISTRY}"; then
        warn "请先登录阿里云容器镜像服务:"
        echo "docker login --username=your_username ${DOCKER_REGISTRY}"
        exit 1
    fi

    # 标记并推送
    local image_tag="${DOCKER_REGISTRY}/${NAMESPACE}/${APP_NAME}-api:${APP_VERSION}"
    docker tag "${APP_NAME}-api:${APP_VERSION}" "$image_tag"
    docker push "$image_tag"

    success "镜像推送完成: $image_tag"
}

# 准备部署包
prepare_deploy_package() {
    info "准备部署包..."

    local deploy_dir="$(dirname "$0")/../../deploy-package"
    mkdir -p "$deploy_dir"

    # 复制 Docker Compose 配置
    cp "$(dirname "$0")/../../infra/docker-compose.yml" "$deploy_dir/"
    cp "$(dirname "$0")/../../infra/docker-compose.dev.yml" "$deploy_dir/"

    # 复制环境变量模板
    cp "$(dirname "$0")/../../apps/api/.env.example" "$deploy_dir/.env.example"

    # 复制部署脚本
    cp "$(dirname "$0")/setup-server.sh" "$deploy_dir/"
    cp "$(dirname "$0")/backup.sh" "$deploy_dir/"

    # 创建部署说明
    cat > "$deploy_dir/README.md" << 'EOF'
# Maneki 部署包

## 文件说明
- docker-compose.yml - 生产环境配置
- docker-compose.dev.yml - 开发环境配置
- .env.example - 环境变量模板
- setup-server.sh - 服务器初始化脚本
- backup.sh - 数据备份脚本

## 部署步骤

1. 将部署包上传到服务器
```bash
scp -r deploy-package root@your-server-ip:/opt/
```

2. 登录服务器执行初始化
```bash
ssh root@your-server-ip
cd /opt/deploy-package
chmod +x setup-server.sh
./setup-server.sh
```

3. 配置环境变量
```bash
cp .env.example .env
vim .env  # 修改配置
```

4. 启动服务
```bash
docker-compose up -d
```

## 常用命令

```bash
# 查看日志
docker-compose logs -f api

# 重启服务
docker-compose restart

# 更新镜像
docker-compose pull && docker-compose up -d

# 备份数据
./backup.sh
```
EOF

    success "部署包准备完成: $deploy_dir"
}

# 远程部署
remote_deploy() {
    if [[ -z "$REMOTE_HOST" ]]; then
        warn "未设置 REMOTE_HOST，跳过远程部署"
        return 0
    fi

    info "远程部署到 $REMOTE_HOST..."

    # 上传部署包
    info "上传部署包..."
    ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" "mkdir -p /opt/maneki"
    scp -i "$SSH_KEY" -r "$(dirname "$0")/../../deploy-package/"* "$REMOTE_USER@$REMOTE_HOST:/opt/maneki/"

    # 执行远程部署
    info "执行远程部署脚本..."
    ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'REMOTE_SCRIPT'
        cd /opt/maneki

        # 如果是首次部署，执行初始化
        if [[ ! -f ".env" ]]; then
            chmod +x setup-server.sh
            ./setup-server.sh
            cp .env.example .env
            echo "请编辑 .env 文件配置环境变量，然后运行: docker-compose up -d"
        else
            # 更新部署
            docker-compose pull
            docker-compose up -d
            docker-compose ps
        fi
REMOTE_SCRIPT

    success "远程部署完成"
}

# 本地开发环境启动
local_dev() {
    info "启动本地开发环境..."

    cd "$(dirname "$0")/../.."

    # 启动基础设施
    docker-compose -f infra/docker-compose.dev.yml up -d

    # 等待数据库就绪
    info "等待数据库就绪..."
    sleep 5

    # 运行数据库迁移
    cd apps/api
    alembic upgrade head 2>/dev/null || warn "迁移失败，可能需要手动执行"

    success "本地开发环境启动完成"
    info "API: http://localhost:8000"
    info "文档: http://localhost:8000/docs"
}

# 显示帮助信息
show_help() {
    cat << EOF
Maneki 阿里云部署脚本

用法: $0 [命令] [选项]

命令:
    build       构建 Docker 镜像
    push        推送镜像到阿里云 ACR
    package     准备部署包
    deploy      执行远程部署 (需设置 REMOTE_HOST)
    dev         启动本地开发环境
    all         执行完整流程 (build + push + package + deploy)
    help        显示帮助信息

环境变量:
    APP_VERSION         应用版本 (默认: latest)
    DOCKER_REGISTRY     镜像仓库地址 (默认: registry.cn-hangzhou.aliyuncs.com)
    NAMESPACE           命名空间 (默认: your-namespace)
    REMOTE_HOST         远程服务器地址
    REMOTE_USER         远程服务器用户 (默认: root)
    SSH_KEY             SSH 密钥路径 (默认: ~/.ssh/id_rsa)

示例:
    # 构建并推送镜像
    $0 build && $0 push

    # 部署到指定服务器
    REMOTE_HOST=47.100.xxx.xxx $0 deploy

    # 完整部署流程
    REMOTE_HOST=47.100.xxx.xxx APP_VERSION=v1.0.0 $0 all

EOF
}

# 主函数
main() {
    local command="${1:-help}"

    case "$command" in
        build)
            check_dependencies
            build_images
            ;;
        push)
            check_dependencies
            push_images
            ;;
        package)
            prepare_deploy_package
            ;;
        deploy)
            check_dependencies
            remote_deploy
            ;;
        dev)
            check_dependencies
            local_dev
            ;;
        all)
            check_dependencies
            build_images
            push_images
            prepare_deploy_package
            remote_deploy
            ;;
        help|*)
            show_help
            ;;
    esac
}

main "$@"
