# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install git for fetching dependencies
RUN apk add --no-cache git

# Copy go mod file
COPY go.mod ./

# Copy source code
COPY . .

# Download and verify dependencies
RUN go get -d -v ./... && \
    go mod download && \
    go mod verify

# Build the application (CGO disabled - MySQL driver is pure Go)
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/main ./cmd/server

# Final stage
FROM alpine:latest

WORKDIR /app

# Install necessary runtime dependencies
RUN apk --no-cache add ca-certificates

# Copy the binary from builder
COPY --from=builder /app/main /app/

# Expose port
EXPOSE 8080

# Make the binary executable
RUN chmod +x /app/main

# Run the application
CMD ["/app/main"]
