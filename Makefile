.PHONY: dev build clean test help frontend api proxy mysql init

# Load .env file if it exists
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# Default values (can be overridden by .env)
DATABASE_HOST ?= localhost
DATABASE_PORT ?= 3306
DATABASE_USER ?= latencypoison
DATABASE_PASSWORD ?= latencypoison
DATABASE_NAME ?= latencypoison
MYSQL_ROOT_PASSWORD ?= rootpassword
API_PORT ?= 8000
PROXY_PORT ?= 8080
FRONTEND_PORT ?= 3000
PHPMYADMIN_PORT ?= 8081
DEFAULT_API_KEY ?= lp_default_admin_key_change_in_production

# =============================================================================
# SETUP
# =============================================================================

# Initialize project (copy .env.example to .env if not exists). Then run make dev.
init:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env file from .env.example"; \
		echo "Please review and update the values in .env"; \
	else \
		echo ".env file already exists"; \
	fi
	@echo "Next: make build && make dev"

# Initialize database (create tables + fixtures). Runs inside API container when using make dev; use this for local DB.
init-db:
	docker-compose run --rm api python init_db.py

# =============================================================================
# FULL STACK (Docker Compose)
# =============================================================================

# Start all services with Docker Compose
dev:
	docker-compose up

# Start all services in background
dev-bg:
	docker-compose up -d

# Build all Docker images
build:
	docker-compose build

# Clean up containers and volumes
clean:
	docker-compose down -v
	docker-compose rm -f

# View logs
logs:
	docker-compose logs -f

# Stop all services
stop:
	docker-compose down

# Restart all services
restart:
	docker-compose down
	docker-compose up -d

# =============================================================================
# STRIPE WEBHOOK (local dev with Docker)
# =============================================================================
# Forwards Stripe webhooks to the API container via Stripe CLI in Docker.
# First time: make stripe-login (browser auth), then make stripe-listen.
# 1. make stripe-listen
# 2. Copy the "whsec_..." signing secret into .env as STRIPE_WEBHOOK_SECRET
# 3. docker-compose restart api
stripe-listen:
	@echo "Forwarding Stripe webhooks to API container (api:8000). Copy whsec_... into .env as STRIPE_WEBHOOK_SECRET, then: docker-compose restart api"
	docker-compose --profile tools run --rm stripe-cli listen --forward-to http://api:8000/api/billing/webhook

# One-time: log in Stripe CLI in Docker (opens browser)
stripe-login:
	docker-compose --profile tools run --rm stripe-cli login

# =============================================================================
# CONFIG PROXY (main feature)
# =============================================================================
# Test the config proxy (requires make dev or dev-bg). Uses DEFAULT_API_KEY from .env.
config-proxy-test:
	@echo "Testing config proxy at http://localhost:$(PROXY_PORT)/v2"
	@echo "Using API key from DEFAULT_API_KEY in .env"
	curl -s -o /dev/null -w "%%{http_code}" "http://localhost:$(PROXY_PORT)/$(DEFAULT_API_KEY)/" && echo " OK" || echo " (start stack with make dev)"

# Example: call config proxy with custom key and URL (usage: make config-proxy-call URL=https://api.github.com/users KEY=lp_xxx)
# Usage: make config-proxy-call KEY=lp_xxx PROXY_PATH=/users
config-proxy-call:
	@key="$(KEY)"; [ -z "$$key" ] && key="$(DEFAULT_API_KEY)"; \
	path="$(PROXY_PATH)"; [ -z "$$path" ] && path=""; \
	curl -v "http://localhost:$(PROXY_PORT)/$$key$$path"

# =============================================================================
# DATABASE (MySQL)
# =============================================================================

# Start MySQL only
mysql:
	docker-compose up -d mysql phpmyadmin

# Connect to MySQL CLI
mysql-cli:
	docker-compose exec mysql mysql -u $(DATABASE_USER) -p$(DATABASE_PASSWORD) $(DATABASE_NAME)

# MySQL root CLI
mysql-root:
	docker-compose exec mysql mysql -u root -p$(MYSQL_ROOT_PASSWORD)

# Reset database (removes all data)
mysql-reset:
	docker-compose down -v mysql
	docker-compose up -d mysql
	@echo "Waiting for MySQL to be ready..."
	@sleep 10
	docker-compose up -d api

# =============================================================================
# INDIVIDUAL SERVICES
# =============================================================================

# --- Frontend ---
frontend-dev:
	cd frontend && npm start

frontend-build:
	cd frontend && npm run build

frontend-install:
	cd frontend && npm install

# --- Python API ---
api-dev:
	cd api && DATABASE_URL=mysql+pymysql://$(DATABASE_USER):$(DATABASE_PASSWORD)@$(DATABASE_HOST):$(DATABASE_PORT)/$(DATABASE_NAME) uvicorn main:app --host 0.0.0.0 --port $(API_PORT) --reload

api-init:
	cd api && DATABASE_URL=mysql+pymysql://$(DATABASE_USER):$(DATABASE_PASSWORD)@$(DATABASE_HOST):$(DATABASE_PORT)/$(DATABASE_NAME) python init_db.py

# --- Go Proxy ---
proxy-dev:
	cd proxy && DATABASE_HOST=$(DATABASE_HOST) DATABASE_PORT=$(DATABASE_PORT) DATABASE_USER=$(DATABASE_USER) DATABASE_PASSWORD=$(DATABASE_PASSWORD) DATABASE_NAME=$(DATABASE_NAME) PORT=$(PROXY_PORT) go run ./cmd/server

proxy-build:
	cd proxy && go build -o bin/latency-poison-proxy ./cmd/server

proxy-test:
	cd proxy && go test -v ./...

# =============================================================================
# DOCKER INDIVIDUAL BUILDS
# =============================================================================

docker-frontend:
	docker build -t latency-poison-frontend:latest ./frontend

docker-api:
	docker build -t latency-poison-api:latest ./api

docker-proxy:
	docker build -t latency-poison-proxy:latest ./proxy

# =============================================================================
# TESTS
# =============================================================================

test:
	docker-compose run --rm api pytest

test-proxy:
	cd proxy && go test -v ./...

# =============================================================================
# HELP
# =============================================================================

help:
	@echo "Latency Poison - The Chaos Proxy"
	@echo ""
	@echo "SETUP (use Makefile):"
	@echo "  make init          - Create .env from .env.example"
	@echo "  make build         - Build Docker images"
	@echo "  make dev           - Start all services"
	@echo "  make init-db       - Run DB migrations + fixtures (optional if using make dev)"
	@echo ""
	@echo "CONFIG PROXY (main feature: /{apiKey}/path):"
	@echo "  make config-proxy-test  - Quick test (uses DEFAULT_API_KEY)"
	@echo "  make config-proxy-call KEY=lp_xxx PATH=/users  - Call proxy with key and path"
	@echo ""
	@echo "FULL STACK:"
	@echo "  make dev           - Start all services"
	@echo "  make dev-bg        - Start in background"
	@echo "  make build         - Build all images"
	@echo "  make clean         - Stop and remove containers/volumes"
	@echo "  make logs          - View logs"
	@echo "  make stop          - Stop all services"
	@echo "  make restart       - Restart all services"
	@echo ""
	@echo "DATABASE (MySQL):"
	@echo "  make mysql         - Start MySQL and phpMyAdmin only"
	@echo "  make mysql-cli     - Connect to MySQL CLI as app user"
	@echo "  make mysql-root    - Connect to MySQL CLI as root"
	@echo "  make mysql-reset   - Reset database (removes all data)"
	@echo ""
	@echo "INDIVIDUAL SERVICES (for local development):"
	@echo "  make frontend-dev  - Start frontend dev server"
	@echo "  make api-dev       - Start Python API"
	@echo "  make proxy-dev     - Start Go proxy"
	@echo ""
	@echo "  make frontend-install - Install frontend dependencies"
	@echo "  make api-init         - Initialize database"
	@echo "  make proxy-build      - Build Go proxy binary"
	@echo ""
	@echo "DOCKER INDIVIDUAL:"
	@echo "  make docker-frontend  - Build frontend image only"
	@echo "  make docker-api       - Build Python API image only"
	@echo "  make docker-proxy     - Build Go proxy image only"
	@echo ""
	@echo "TESTING:"
	@echo "  make test          - Run Python API tests"
	@echo "  make test-proxy    - Run Go proxy tests"
	@echo ""
	@echo "CONFIGURATION:"
	@echo "  Copy .env.example to .env and customize values"
	@echo "  Or run 'make init' to create .env automatically"
	@echo ""
	@echo "URLs when running (defaults, configurable in .env):"
	@echo "  Frontend:       http://localhost:$(FRONTEND_PORT)"
	@echo "  API:            http://localhost:$(API_PORT)"
	@echo "  Config proxy:   http://localhost:$(PROXY_PORT)/{your_key}/path (main feature, use Configs page)"
	@echo "  phpMyAdmin:     http://localhost:$(PHPMYADMIN_PORT)"

.DEFAULT_GOAL := help
