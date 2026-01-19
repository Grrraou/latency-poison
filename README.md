# Latency Poison

A web application for testing and monitoring API latency.

## Prerequisites

- Docker
- Docker Compose
- Make

## Setup

1. Clone the repository
2. Run the following commands:

```bash
make build  # Build the Docker images
make dev    # Start the development environment
```

The application will be available at:
- Frontend: http://localhost:3000
- API: http://localhost:8000
- phpMyAdmin: http://localhost:8081/

## Development

- `make dev` - Start the development environment
- `make build` - Rebuild the Docker images
- `make clean` - Clean up Docker resources

## Project Structure

- `frontend/` - React frontend application
- `api/` - FastAPI backend application

## Features

- Configurable latency injection
- Random failure simulation
- Sandbox mode for testing without real API calls
- Quick testing interface
- Detailed response analysis

## Quick Start

### Using Makefile

The project includes a Makefile for common operations:

```bash
# Start the development environment
make dev

# Build the production environment
make build

# Run tests
make test

# Clean build artifacts
make clean

# Start the production server
make start

# Stop all services
make stop
```

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/latency-poison.git
cd latency-poison
```

2. Start the development environment:
```bash
make dev
```

3. Access the application at `http://localhost:3000`

## API Usage

### Quick Sandbox Testing

The Quick Sandbox interface allows you to test APIs with configurable parameters:

1. **URL**: The API endpoint to test
   - Example: `https://api.github.com/users/octocat`
   - Example: `https://jsonplaceholder.typicode.com/posts/1`

2. **Latency Settings**:
   - Min Latency: Minimum delay in milliseconds (0-5000ms)
   - Max Latency: Maximum delay in milliseconds (0-5000ms)

3. **Failure Rate**:
   - Percentage chance of request failure (0-100%)
   - Simulates 500 errors for testing error handling

4. **Sandbox Mode**:
   - When enabled, simulates responses without real API calls
   - Useful for testing without internet access

### Direct API Calls

You can also use the proxy API directly:

```bash
# Basic request
curl "http://localhost:8000/proxy?url=https://api.github.com/users/octocat"

# With latency settings
curl "http://localhost:8000/proxy?url=https://api.github.com/users/octocat&min_latency=1000&max_latency=3000"

# With failure rate
curl "http://localhost:8000/proxy?url=https://api.github.com/users/octocat&fail_rate=0.5"

# With sandbox mode
curl "http://localhost:8000/proxy?url=https://api.github.com/users/octocat&sandbox=true"

# All parameters together
curl "http://localhost:8000/proxy?url=https://api.github.com/users/octocat&min_latency=1000&max_latency=3000&fail_rate=0.5&sandbox=true"
```

### API Parameters

- `url` (required): The target API endpoint
- `min_latency` (optional): Minimum delay in milliseconds (default: 0)
- `max_latency` (optional): Maximum delay in milliseconds (default: 1000)
- `fail_rate` (optional): Probability of failure (0-1, default: 0)
- `sandbox` (optional): Enable sandbox mode (true/false, default: false)

## Architecture

- Frontend: React with Material-UI
- Backend: FastAPI
- Docker containers for development and production
