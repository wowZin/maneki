.PHONY: help install dev test lint docker-build docker-run migrate

help:
	@echo "Data Service - Makefile Commands"
	@echo ""
	@echo "  make install      - Install dependencies"
	@echo "  make dev          - Run development server"
	@echo "  make test         - Run tests"
	@echo "  make lint         - Run linter (black)"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-run   - Run with Docker Compose"
	@echo "  make migrate      - Run database migrations"

install:
	pip install -r requirements.txt

dev:
	python main.py

test:
	pytest tests/ -v

lint:
	black app/ tests/

docker-build:
	docker build -t maneki-data-service:latest .

docker-run:
	docker-compose up -d

docker-stop:
	docker-compose down

migrate:
	alembic upgrade head

init-db:
	python -c "from app.db.init_db import init_db; init_db()"
