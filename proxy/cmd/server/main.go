package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
	"go.uber.org/zap"

	"github.com/grrr/latency-sim-proxy/internal/config"
	"github.com/grrr/latency-sim-proxy/internal/handlers"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found")
	}

	// Initialize logger
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer logger.Sync()

	// Initialize MySQL connection
	mysqlClient, err := config.NewMySQLClient()
	if err != nil {
		logger.Fatal("Failed to connect to MySQL database", zap.Error(err))
	}
	defer mysqlClient.Close()

	logger.Info("Connected to MySQL database")
	config.EnsureUsageLogTable(mysqlClient.GetDB(), logger)

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName: "Latency Simulation Proxy",
	})

	// Add CORS middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE,PATCH,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization,X-API-Key",
	}))

	// Initialize handlers with MySQL database
	handler := handlers.NewHandler(logger, mysqlClient.GetDB())

	app.Get("/sandbox", handler.SandboxHandler)
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})
	// Config proxy: /{apiKey} or /{apiKey}/* -> one key -> one target URL + chaos
	app.All("/:apiKey", handler.ConfigKeyProxyHandler)
	app.All("/:apiKey/*", handler.ConfigKeyProxyHandler)

	// Start API server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	logger.Info("Starting API server", zap.String("port", port))
	if err := app.Listen(":" + port); err != nil {
		logger.Fatal("Failed to start server", zap.Error(err))
	}
}
