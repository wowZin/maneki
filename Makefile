.PHONY: help \
	restart-api restart-data restart-web restart-db restart-redis restart-infra restart-all \
	stop-api stop-data stop-web stop-db stop-redis stop-all \
	start-api start-data start-web start-db start-redis start-infra start-all

API_PORT     ?= 8080
DATA_PORT    ?= 8001
WEB_PORT     ?= 5173
COMPOSE_FILE ?= infra/docker-compose.dev.yml

help:
	@echo "Maneki 服务端快捷命令"
	@echo ""
	@echo "=== 应用服务 ==="
	@echo "  make restart-api   - 编译并重启 Go API 服务 (port $(API_PORT))"
	@echo "  make restart-data  - 重启 Python Data Service (port $(DATA_PORT))"
	@echo "  make restart-web   - 重启前端开发服务器 (port $(WEB_PORT))"
	@echo ""
	@echo "=== 基础设施 (Docker) ==="
	@echo "  make restart-db    - 重启 TimescaleDB (port 5432)"
	@echo "  make restart-redis - 重启 Redis (port 6379)"
	@echo "  make restart-infra - 重启 DB + Redis"
	@echo ""
	@echo "=== 全部 ==="
	@echo "  make restart-all   - 重启所有服务（含 DB/Redis）"
	@echo ""
	@echo "  make start-* / stop-*  - 启动/停止单个服务"


# ---------- Stop ----------

stop-api:
	@echo ">>> Stopping API service..."
	@-kill -9 $$(lsof -ti tcp:$(API_PORT)) 2>/dev/null || true
	@echo ">>> API stopped."

stop-data:
	@echo ">>> Stopping Data service..."
	@-kill -9 $$(lsof -ti tcp:$(DATA_PORT)) 2>/dev/null || true
	@echo ">>> Data service stopped."

stop-web:
	@echo ">>> Stopping Web admin..."
	@-kill -9 $$(lsof -ti tcp:$(WEB_PORT)) 2>/dev/null || true
	@echo ">>> Web admin stopped."

stop-db:
	@echo ">>> Stopping TimescaleDB..."
	@docker compose -f $(COMPOSE_FILE) stop timescaledb
	@echo ">>> TimescaleDB stopped."

stop-redis:
	@echo ">>> Stopping Redis..."
	@docker compose -f $(COMPOSE_FILE) stop redis
	@echo ">>> Redis stopped."

stop-all: stop-api stop-data stop-web stop-db stop-redis

# ---------- Start ----------

start-api:
	@echo ">>> Building API..."
	@cd apps/api && go build -o main cmd/main.go
	@echo ">>> Starting API service on port $(API_PORT)..."
	@cd apps/api && nohup ./main > /dev/null 2>&1 &
	@sleep 1
	@echo ">>> API started."

start-data:
	@echo ">>> Starting Data service on port $(DATA_PORT)..."
	@cd apps/service-data && nohup python main.py > /dev/null 2>&1 &
	@sleep 1
	@echo ">>> Data service started."

start-web:
	@echo ">>> Starting Web admin on port $(WEB_PORT)..."
	@cd apps/web-admin && nohup pnpm dev > /dev/null 2>&1 &
	@sleep 2
	@echo ">>> Web admin started."

start-db:
	@echo ">>> Starting TimescaleDB..."
	@docker compose -f $(COMPOSE_FILE) up -d timescaledb
	@sleep 3
	@echo ">>> TimescaleDB started."

start-redis:
	@echo ">>> Starting Redis..."
	@docker compose -f $(COMPOSE_FILE) up -d redis
	@sleep 1
	@echo ">>> Redis started."

start-infra: start-db start-redis

start-all: start-infra start-api start-data start-web

# ---------- Restart ----------

restart-api: stop-api start-api

restart-data: stop-data start-data

restart-web: stop-web start-web

restart-db:
	@echo ">>> Restarting TimescaleDB..."
	@docker compose -f $(COMPOSE_FILE) up -d timescaledb
	@docker compose -f $(COMPOSE_FILE) restart timescaledb
	@echo ">>> TimescaleDB restarted."

restart-redis:
	@echo ">>> Restarting Redis..."
	@docker compose -f $(COMPOSE_FILE) up -d redis
	@docker compose -f $(COMPOSE_FILE) restart redis
	@echo ">>> Redis restarted."

restart-infra: restart-db restart-redis

restart-all: stop-api stop-data stop-web restart-infra start-api start-data start-web
