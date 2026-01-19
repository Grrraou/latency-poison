.PHONY: dev build clean test help frontend api proxy mysql

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
# DATABASE (MySQL)
# =============================================================================

# Start MySQL only
mysql:
	docker-compose up -d mysql phpmyadmin

# Connect to MySQL CLI
mysql-cli:
	docker-compose exec mysql mysql -u latencypoison -platencypoison latencypoison

# MySQL root CLI
mysql-root:
	docker-compose exec mysql mysql -u root -prootpassword

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
	cd api && DATABASE_URL=mysql+pymysql://latencypoison:latencypoison@localhost:3306/latencypoison uvicorn main:app --host 0.0.0.0 --port 8000 --reload

api-init:
	cd api && DATABASE_URL=mysql+pymysql://latencypoison:latencypoison@localhost:3306/latencypoison python init_db.py

# --- Go Proxy ---
proxy-dev:
	cd proxy && DATABASE_HOST=localhost DATABASE_PORT=3306 DATABASE_USER=latencypoison DATABASE_PASSWORD=latencypoison DATABASE_NAME=latencypoison PORT=8080 go run ./cmd/server

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
	@echo "FULL STACK (Docker Compose):"
	@echo "  make dev           - Start all services (frontend, api, proxy, mysql)"
	@echo "  make dev-bg        - Start all services in background"
	@echo "  make build         - Build all Docker images"
	@echo "  make clean         - Stop and remove containers/volumes"
	@echo "  make logs          - View logs from all services"
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
	@echo "  make frontend-dev  - Start frontend dev server (port 3000)"
	@echo "  make api-dev       - Start Python API (port 8000)"
	@echo "  make proxy-dev     - Start Go proxy (port 8080)"
	@echo ""
	@echo "  make frontend-install - Install frontend dependencies"
	@echo "  make api-init         - Initialize database"
	@echo "  make proxy-build      - Build Go proxy binary"
	@echo ""
	@echo "DOCKER INDIVIDUAL:"
	@echo "  make docker-frontend - Build frontend image only"
	@echo "  make docker-api      - Build Python API image only"
	@echo "  make docker-proxy    - Build Go proxy image only"
	@echo ""
	@echo "TESTING:"
	@echo "  make test          - Run Python API tests"
	@echo "  make test-proxy    - Run Go proxy tests"
	@echo ""
	@echo "URLs when running:"
	@echo "  Frontend:    http://localhost:3000"
	@echo "  API:         http://localhost:8000"
	@echo "  Proxy:       http://localhost:8080"
	@echo "  phpMyAdmin:  http://localhost:8081"

.DEFAULT_GOAL := help
