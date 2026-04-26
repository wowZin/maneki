#!/bin/bash
set -e

echo "==> Restarting dev environment..."

# 启动 Docker 容器
docker start stock_timescaledb stock_redis 2>/dev/null || true

# 检查后端
if ! lsof -i :8080 >/dev/null 2>&1; then
  echo "==> Backend not running, please run: cd apps/api && go run cmd/main.go"
else
  echo "==> Backend OK (port 8080)"
fi

# 检查前端
if ! lsof -i :5173 >/dev/null 2>&1; then
  echo "==> Web not running, please run: cd apps/web && npm run dev"
else
  echo "==> Web OK (port 5173)"
fi

# 检查 admin 前端
if ! lsof -i :5174 >/dev/null 2>&1; then
  echo "==> Web-admin not running, please run: cd apps/web-admin && npm run dev"
else
  echo "==> Web-admin OK (port 5174)"
fi

echo "==> Done"
