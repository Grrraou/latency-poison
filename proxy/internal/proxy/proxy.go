package proxy

import (
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
	"go.uber.org/zap"
)

// ProxyConfig holds the configuration for proxy behavior
type ProxyConfig struct {
	TargetURL  string
	FailRate   float64
	FailCodes  []int
	MinLatency int
	MaxLatency int
}

// ProxyHandler handles the proxying of requests with latency and error injection
type ProxyHandler struct {
	logger *zap.Logger
	config *ProxyConfig
	client *fasthttp.Client
}

// NewProxyHandler creates a new ProxyHandler
func NewProxyHandler(logger *zap.Logger, config *ProxyConfig) *ProxyHandler {
	return &ProxyHandler{
		logger: logger,
		config: config,
		client: &fasthttp.Client{},
	}
}

// HandleFiberRequest processes the incoming Fiber request with configured latency and error injection
func (p *ProxyHandler) HandleFiberRequest(c *fiber.Ctx) error {
	// Add latency if configured (always applied, even for errors)
	if p.config.MinLatency > 0 || p.config.MaxLatency > 0 {
		latency := p.getRandomLatency()
		time.Sleep(time.Duration(latency) * time.Millisecond)
	}

	// Check if we should inject an error
	if p.shouldInjectError() {
		return p.injectError(c)
	}

	// Parse target URL
	target, err := url.Parse(p.config.TargetURL)
	if err != nil {
		p.logger.Error("Failed to parse target URL", zap.Error(err))
		return fmt.Errorf("invalid target URL: %v", err)
	}

	// Create request to target
	req := fasthttp.AcquireRequest()
	defer fasthttp.ReleaseRequest(req)

	// Copy original request headers and body
	c.Request().Header.CopyTo(&req.Header)
	req.SetBody(c.Body())
	req.SetRequestURI(target.String())
	req.Header.SetMethod(string(c.Method()))

	// Send request
	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseResponse(resp)

	if err := p.client.Do(req, resp); err != nil {
		p.logger.Error("Failed to proxy request", zap.Error(err))
		return fmt.Errorf("failed to proxy request: %v", err)
	}

	// Copy response headers and body
	resp.Header.CopyTo(&c.Response().Header)
	c.Status(resp.StatusCode())
	return c.Send(resp.Body())
}

// shouldInjectError determines if an error should be injected based on fail rate
func (p *ProxyHandler) shouldInjectError() bool {
	if p.config.FailRate <= 0 {
		return false
	}
	return rand.Float64() < p.config.FailRate
}

// injectError sends an error response
func (p *ProxyHandler) injectError(c *fiber.Ctx) error {
	if len(p.config.FailCodes) == 0 {
		return c.Status(fiber.StatusInternalServerError).
			SendString("Internal Server Error")
	}

	// Select a random error code
	errorCode := p.config.FailCodes[rand.Intn(len(p.config.FailCodes))]
	return c.Status(errorCode).SendString(http.StatusText(errorCode))
}

// getRandomLatency returns a random latency within the configured range
func (p *ProxyHandler) getRandomLatency() int {
	if p.config.MaxLatency <= p.config.MinLatency {
		return p.config.MinLatency
	}
	diff := p.config.MaxLatency - p.config.MinLatency
	if diff <= 0 {
		return p.config.MinLatency
	}
	return p.config.MinLatency + rand.Intn(diff)
}

// ParseFailCodes converts a comma-separated string of error codes to integers
func ParseFailCodes(codesStr string) ([]int, error) {
	if codesStr == "" {
		return nil, nil
	}

	codes := strings.Split(codesStr, ",")
	result := make([]int, 0, len(codes))

	for _, code := range codes {
		code = strings.TrimSpace(code)
		if code == "" {
			continue
		}

		value, err := strconv.Atoi(code)
		if err != nil {
			return nil, err
		}
		result = append(result, value)
	}

	return result, nil
}
