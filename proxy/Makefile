.PHONY: build run test clean docker-build docker-run

# Variables
BINARY_NAME=latency-poison-proxy
DOCKER_IMAGE=latency-poison-proxy:latest

# Database defaults (for local development)
DATABASE_HOST ?= localhost
DATABASE_PORT ?= 3306
DATABASE_USER ?= latencypoison
DATABASE_PASSWORD ?= latencypoison
DATABASE_NAME ?= latencypoison

# Build the application
build:
	go build -o bin/$(BINARY_NAME) ./cmd/server

# Run the application locally (requires MySQL running locally or in Docker)
run:
	DATABASE_HOST=$(DATABASE_HOST) \
	DATABASE_PORT=$(DATABASE_PORT) \
	DATABASE_USER=$(DATABASE_USER) \
	DATABASE_PASSWORD=$(DATABASE_PASSWORD) \
	DATABASE_NAME=$(DATABASE_NAME) \
	PORT=8080 \
	go run ./cmd/server

# Run tests
test:
	go test -v ./...

# Clean build artifacts
clean:
	rm -rf bin/
	go clean

# Build Docker image standalone
docker-build:
	docker build -t $(DOCKER_IMAGE) .

# Run with Docker standalone (connects to host MySQL)
docker-run:
	docker run -p 8080:8080 \
		-e DATABASE_HOST=host.docker.internal \
		-e DATABASE_PORT=3306 \
		-e DATABASE_USER=latencypoison \
		-e DATABASE_PASSWORD=latencypoison \
		-e DATABASE_NAME=latencypoison \
		-e PORT=8080 \
		$(DOCKER_IMAGE)

# Format code
fmt:
	go fmt ./...

# Lint code
lint:
	golangci-lint run

# Download dependencies
deps:
	go mod download
	go mod verify

# Help
help:
	@echo "Latency Poison Proxy (Go API)"
	@echo ""
	@echo "Available commands:"
	@echo "  make build        - Build the binary"
	@echo "  make run          - Run locally (requires MySQL)"
	@echo "  make test         - Run tests"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-run   - Run with Docker (connects to host MySQL)"
	@echo "  make fmt          - Format code"
	@echo "  make deps         - Download dependencies"
	@echo "  make help         - Show this help"
	@echo ""
	@echo "Environment variables for 'make run':"
	@echo "  DATABASE_HOST     - MySQL host (default: localhost)"
	@echo "  DATABASE_PORT     - MySQL port (default: 3306)"
	@echo "  DATABASE_USER     - MySQL user (default: latencypoison)"
	@echo "  DATABASE_PASSWORD - MySQL password (default: latencypoison)"
	@echo "  DATABASE_NAME     - MySQL database (default: latencypoison)"

.DEFAULT_GOAL := help
