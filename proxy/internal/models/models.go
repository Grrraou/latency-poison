package models

import (
	"database/sql"
	"time"
)

// ApiKey represents an API key from the database
type ApiKey struct {
	ID             int
	Name           string
	Key            string
	IsActive       bool
	AllCollections bool
	RequestCount   int
	CreatedAt      time.Time
	LastUsedAt     sql.NullTime
	OwnerID        int
}

// Collection represents a collection from the database
type Collection struct {
	ID           int
	Name         string
	Description  sql.NullString
	IsActive     bool
	RequestCount int
	OwnerID      int
}

// Endpoint represents an endpoint from the database
type Endpoint struct {
	ID           int
	Name         string
	URL          string
	Method       string
	Headers      sql.NullString // JSON stored as string
	Body         sql.NullString // JSON stored as string
	CollectionID int
	FailRate     int
	MinLatency   int
	MaxLatency   int
	Sandbox      bool
	IsActive     bool
	RequestCount int
}

// Repository handles database operations
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new Repository
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// GetApiKeyByKey retrieves an API key by its key string
func (r *Repository) GetApiKeyByKey(key string) (*ApiKey, error) {
	apiKey := &ApiKey{}
	err := r.db.QueryRow(`
		SELECT id, name, `+"`key`"+`, is_active, all_collections, request_count, created_at, last_used_at, owner_id
		FROM api_keys
		WHERE `+"`key`"+` = ?
	`, key).Scan(
		&apiKey.ID,
		&apiKey.Name,
		&apiKey.Key,
		&apiKey.IsActive,
		&apiKey.AllCollections,
		&apiKey.RequestCount,
		&apiKey.CreatedAt,
		&apiKey.LastUsedAt,
		&apiKey.OwnerID,
	)
	if err != nil {
		return nil, err
	}
	return apiKey, nil
}

// GetCollectionByID retrieves a collection by its ID
func (r *Repository) GetCollectionByID(id int) (*Collection, error) {
	collection := &Collection{}
	err := r.db.QueryRow(`
		SELECT id, name, description, is_active, request_count, owner_id
		FROM collections
		WHERE id = ?
	`, id).Scan(
		&collection.ID,
		&collection.Name,
		&collection.Description,
		&collection.IsActive,
		&collection.RequestCount,
		&collection.OwnerID,
	)
	if err != nil {
		return nil, err
	}
	return collection, nil
}

// GetEndpointByCollectionAndURL finds an endpoint matching the collection and target URL
// Supports wildcard patterns: * matches any characters
// Examples: https://api.github.com/*, https://*.github.com/*, *
func (r *Repository) GetEndpointByCollectionAndURL(collectionID int, targetURL string) (*Endpoint, error) {
	// Get all active endpoints for the collection
	endpoints, err := r.GetEndpointsByCollection(collectionID)
	if err != nil {
		return nil, err
	}

	var bestMatch *Endpoint
	bestScore := -1

	for _, ep := range endpoints {
		if matchesPattern(ep.URL, targetURL) {
			// Calculate specificity score (more specific patterns = higher score)
			score := calculatePatternScore(ep.URL)
			if score > bestScore {
				bestScore = score
				bestMatch = ep
			}
		}
	}

	if bestMatch == nil {
		return nil, sql.ErrNoRows
	}
	return bestMatch, nil
}

// matchesPattern checks if a URL matches a wildcard pattern
// * matches any sequence of characters
func matchesPattern(pattern, url string) bool {
	// Handle exact match or catch-all
	if pattern == "*" || pattern == url {
		return true
	}

	// Convert pattern to a simple glob match
	parts := splitPattern(pattern)
	return globMatch(parts, url)
}

// splitPattern splits a pattern by * into parts
func splitPattern(pattern string) []string {
	var parts []string
	current := ""
	for _, ch := range pattern {
		if ch == '*' {
			parts = append(parts, current)
			current = ""
		} else {
			current += string(ch)
		}
	}
	parts = append(parts, current)
	return parts
}

// globMatch performs glob matching with the split pattern parts
func globMatch(parts []string, s string) bool {
	if len(parts) == 0 {
		return true
	}
	if len(parts) == 1 {
		return parts[0] == s
	}

	// First part must be a prefix
	if !hasPrefix(s, parts[0]) {
		return false
	}
	s = s[len(parts[0]):]

	// Last part must be a suffix
	lastPart := parts[len(parts)-1]
	if lastPart != "" {
		if !hasSuffix(s, lastPart) {
			return false
		}
		s = s[:len(s)-len(lastPart)]
	}

	// Middle parts must appear in order
	for i := 1; i < len(parts)-1; i++ {
		part := parts[i]
		if part == "" {
			continue
		}
		idx := indexOf(s, part)
		if idx == -1 {
			return false
		}
		s = s[idx+len(part):]
	}

	return true
}

func hasPrefix(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}

func hasSuffix(s, suffix string) bool {
	return len(s) >= len(suffix) && s[len(s)-len(suffix):] == suffix
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// calculatePatternScore returns a specificity score for a pattern
// Higher score = more specific (should be preferred)
// * alone = 0, https://* = 8, https://api.github.com/* = 24
func calculatePatternScore(pattern string) int {
	if pattern == "*" {
		return 0
	}
	// Count non-wildcard characters as the score
	score := 0
	for _, ch := range pattern {
		if ch != '*' {
			score++
		}
	}
	return score
}

// GetEndpointByID finds an endpoint by its ID
func (r *Repository) GetEndpointByID(endpointID int) (*Endpoint, error) {
	endpoint := &Endpoint{}
	err := r.db.QueryRow(`
		SELECT id, name, url, method, headers, body, collection_id, fail_rate, min_latency, max_latency, sandbox, is_active, request_count
		FROM endpoints
		WHERE id = ? AND is_active = 1
	`, endpointID).Scan(
		&endpoint.ID,
		&endpoint.Name,
		&endpoint.URL,
		&endpoint.Method,
		&endpoint.Headers,
		&endpoint.Body,
		&endpoint.CollectionID,
		&endpoint.FailRate,
		&endpoint.MinLatency,
		&endpoint.MaxLatency,
		&endpoint.Sandbox,
		&endpoint.IsActive,
		&endpoint.RequestCount,
	)
	if err != nil {
		return nil, err
	}
	return endpoint, nil
}

// GetEndpointsByCollection retrieves all active endpoints for a collection
func (r *Repository) GetEndpointsByCollection(collectionID int) ([]*Endpoint, error) {
	rows, err := r.db.Query(`
		SELECT id, name, url, method, headers, body, collection_id, fail_rate, min_latency, max_latency, sandbox, is_active, request_count
		FROM endpoints
		WHERE collection_id = ? AND is_active = 1
	`, collectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var endpoints []*Endpoint
	for rows.Next() {
		endpoint := &Endpoint{}
		err := rows.Scan(
			&endpoint.ID,
			&endpoint.Name,
			&endpoint.URL,
			&endpoint.Method,
			&endpoint.Headers,
			&endpoint.Body,
			&endpoint.CollectionID,
			&endpoint.FailRate,
			&endpoint.MinLatency,
			&endpoint.MaxLatency,
			&endpoint.Sandbox,
			&endpoint.IsActive,
			&endpoint.RequestCount,
		)
		if err != nil {
			return nil, err
		}
		endpoints = append(endpoints, endpoint)
	}
	return endpoints, nil
}

// HasApiKeyAccessToCollection checks if an API key has access to a collection
func (r *Repository) HasApiKeyAccessToCollection(apiKeyID int, collectionID int) (bool, error) {
	// First check if the API key has all_collections access
	var allCollections bool
	err := r.db.QueryRow(`SELECT all_collections FROM api_keys WHERE id = ?`, apiKeyID).Scan(&allCollections)
	if err != nil {
		return false, err
	}
	if allCollections {
		return true, nil
	}

	// Check the many-to-many relationship
	var count int
	err = r.db.QueryRow(`
		SELECT COUNT(*) FROM apikey_collections
		WHERE apikey_id = ? AND collection_id = ?
	`, apiKeyID, collectionID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// IncrementApiKeyRequestCount increments the request count for an API key
func (r *Repository) IncrementApiKeyRequestCount(apiKeyID int) error {
	_, err := r.db.Exec(`
		UPDATE api_keys
		SET request_count = request_count + 1, last_used_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, apiKeyID)
	return err
}

// IncrementCollectionRequestCount increments the request count for a collection
func (r *Repository) IncrementCollectionRequestCount(collectionID int) error {
	_, err := r.db.Exec(`
		UPDATE collections
		SET request_count = request_count + 1
		WHERE id = ?
	`, collectionID)
	return err
}

// IncrementEndpointRequestCount increments the request count for an endpoint
func (r *Repository) IncrementEndpointRequestCount(endpointID int) error {
	_, err := r.db.Exec(`
		UPDATE endpoints
		SET request_count = request_count + 1
		WHERE id = ?
	`, endpointID)
	return err
}
