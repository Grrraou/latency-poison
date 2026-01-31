package handlers

import (
	"database/sql"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/grrr/latency-sim-proxy/internal/models"
	"github.com/grrr/latency-sim-proxy/internal/proxy"
)

// Handler holds the application handlers and dependencies
type Handler struct {
	logger *zap.Logger
	repo   *models.Repository
}

// NewHandler creates a new Handler instance
func NewHandler(logger *zap.Logger, db *sql.DB) *Handler {
	return &Handler{
		logger: logger,
		repo:   models.NewRepository(db),
	}
}

// SandboxHandler handles the sandbox endpoint (no auth required)
func (h *Handler) SandboxHandler(c *fiber.Ctx) error {
	// Parse query parameters
	targetURL := c.Query("url")
	if targetURL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "url parameter is required",
		})
	}
	// Only allow http/https to prevent SSRF
	targetLower := strings.ToLower(targetURL)
	if !strings.HasPrefix(targetLower, "http://") && !strings.HasPrefix(targetLower, "https://") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "url must use http or https scheme",
		})
	}

	failRate, _ := strconv.ParseFloat(c.Query("failrate", "0"), 64)
	failCodes, _ := proxy.ParseFailCodes(c.Query("failCodes"))
	minLatency, _ := strconv.Atoi(c.Query("minLatency", "0"))
	maxLatency, _ := strconv.Atoi(c.Query("maxLatency", "0"))

	// Create proxy configuration
	config := &proxy.ProxyConfig{
		TargetURL:  targetURL,
		FailRate:   failRate,
		FailCodes:  failCodes,
		MinLatency: minLatency,
		MaxLatency: maxLatency,
	}

	// Create proxy handler
	proxyHandler := proxy.NewProxyHandler(h.logger, config)

	// Handle the request
	if err := proxyHandler.HandleFiberRequest(c); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return nil
}

// ConfigKeyProxyHandler: path /{apiKey} or /{apiKey}/* -> one key -> one target URL + chaos -> forward
// Example: https://localhost:8080/lp_xxx/users -> forwards to target_url + /users with fail_rate/latency applied
func (h *Handler) ConfigKeyProxyHandler(c *fiber.Ctx) error {
	apiKeyStr := c.Params("apiKey")
	if apiKeyStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "API key path segment is required"})
	}

	configKey, err := h.repo.GetConfigApiKeyByKey(apiKeyStr)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or inactive API key",
			})
		}
		h.logger.Error("Config key proxy: get key", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal server error"})
	}

	// Debug: expose fail_rate so clients can verify (remove in production if desired)
	c.Set("X-Latency-Poison-Fail-Rate", strconv.Itoa(configKey.FailRate))

	if configKey.TargetURL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Config key has no target URL. Set target_url in Configs.",
		})
	}
	// Only allow http/https to prevent SSRF via other schemes
	if !strings.HasPrefix(strings.ToLower(configKey.TargetURL), "http://") && !strings.HasPrefix(strings.ToLower(configKey.TargetURL), "https://") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "target_url must use http or https scheme",
		})
	}

	// Build target URL: target_url (base) + path after key + query
	pathRest := c.Params("*")
	base := strings.TrimRight(configKey.TargetURL, "/")
	if pathRest != "" {
		base = base + "/" + strings.TrimLeft(pathRest, "/")
	}
	targetURL := base
	if q := c.Context().QueryArgs().String(); q != "" {
		targetURL = targetURL + "?" + q
	}

	method := strings.ToUpper(string(c.Method()))
	configMethod := strings.ToUpper(configKey.Method)
	if configMethod != "ANY" && configMethod != method {
		return c.Status(fiber.StatusMethodNotAllowed).JSON(fiber.Map{
			"error": fmt.Sprintf("Method %s not allowed (config method: %s)", method, configKey.Method),
		})
	}

	// Record usage for every request (including when we later simulate failure)
	if err := h.repo.InsertUsage(configKey.ID, time.Now()); err != nil {
		h.logger.Error("Usage log insert failed (dashboard usage will be empty)", zap.Error(err))
		c.Set("X-Latency-Poison-Usage-Recorded", "0")
	} else {
		c.Set("X-Latency-Poison-Usage-Recorded", "1")
	}

	// Apply latency
	if configKey.MinLatency > 0 || configKey.MaxLatency > 0 {
		latency := configKey.MinLatency
		if configKey.MaxLatency > configKey.MinLatency {
			latency = configKey.MinLatency + rand.Intn(configKey.MaxLatency-configKey.MinLatency)
		}
		time.Sleep(time.Duration(latency) * time.Millisecond)
	}

	// Simulate failure: FailRate is 0–100 from DB, compare as 0–1 like sandbox
	if configKey.FailRate > 0 && rand.Float64() < (float64(configKey.FailRate)/100.0) {
		code := 500
		if len(configKey.ErrorCodes) > 0 {
			code = configKey.ErrorCodes[rand.Intn(len(configKey.ErrorCodes))]
		}
		return c.Status(code).SendString(http.StatusText(code))
	}

	// Forward to target
	proxyConfig := &proxy.ProxyConfig{
		TargetURL:  targetURL,
		FailRate:   0,
		FailCodes:  configKey.ErrorCodes,
		MinLatency: 0,
		MaxLatency: 0,
	}
	proxyHandler := proxy.NewProxyHandler(h.logger, proxyConfig)
	if err := proxyHandler.HandleFiberRequest(c); err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	return nil
}
