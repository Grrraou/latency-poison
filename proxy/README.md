# Latency Poison Proxy

High-performance Go proxy server for Latency Poison. Handles request proxying with configurable latency injection and failure simulation.

## Requirements

- Go 1.21+
- MySQL 8.0+ (shared database with Python API)

## Running Standalone

### With Go installed locally

```bash
# Set environment variables
export DATABASE_HOST=localhost
export DATABASE_PORT=3306
export DATABASE_USER=latencypoison
export DATABASE_PASSWORD=latencypoison
export DATABASE_NAME=latencypoison
export PORT=8080

# Run
go run ./cmd/server

# Or build and run
go build -o bin/latency-poison-proxy ./cmd/server
./bin/latency-poison-proxy
```

### With Docker

```bash
# Build
docker build -t latency-poison-proxy:latest .

# Run (requires MySQL to be running)
docker run -p 8080:8080 \
  -e DATABASE_HOST=host.docker.internal \
  -e DATABASE_PORT=3306 \
  -e DATABASE_USER=latencypoison \
  -e DATABASE_PASSWORD=latencypoison \
  -e DATABASE_NAME=latencypoison \
  -e PORT=8080 \
  latency-poison-proxy:latest
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_HOST` | `localhost` | MySQL host |
| `DATABASE_PORT` | `3306` | MySQL port |
| `DATABASE_USER` | `latencypoison` | MySQL user |
| `DATABASE_PASSWORD` | `latencypoison` | MySQL password |
| `DATABASE_NAME` | `latencypoison` | MySQL database name |
| `PORT` | `8080` | Port to listen on |

## API Endpoints

### Health Check
```
GET /health
```

### Sandbox (No Auth)
```
GET /sandbox?url=<target>&minLatency=<ms>&maxLatency=<ms>&failrate=<0-1>&failCodes=<codes>
```

### Proxy (With API Key)
```
ANY /proxy/:collectionId?api_key=<key>&url=<target>
```

## Project Structure

```
proxy/
├── cmd/
│   └── server/
│       └── main.go       # Entry point
├── internal/
│   ├── config/
│   │   └── mysql.go      # Database connection
│   ├── handlers/
│   │   └── handlers.go   # HTTP handlers
│   ├── models/
│   │   └── models.go     # Data models & repository
│   └── proxy/
│       └── proxy.go      # Proxy logic
├── Dockerfile
├── go.mod
├── Makefile
└── README.md
```
