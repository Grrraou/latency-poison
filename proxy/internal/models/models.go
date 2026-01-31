package models

import (
	"database/sql"
	"encoding/json"
	"time"
)

// ConfigApiKey: one key -> one target URL + chaos settings
type ConfigApiKey struct {
	ID         int
	Name       string
	Key        string
	IsActive   bool
	TargetURL  string
	FailRate   int
	MinLatency int
	MaxLatency int
	Method     string
	ErrorCodes []int
	CreatedAt  time.Time
	OwnerID    int
}

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetConfigApiKeyByKey(key string) (*ConfigApiKey, error) {
	c := &ConfigApiKey{}
	var errorCodesJSON string
	var failRate int64
	err := r.db.QueryRow(`
		SELECT id, name, `+"`key`"+`, is_active, COALESCE(target_url, ''), COALESCE(fail_rate, 0), COALESCE(min_latency, 0), COALESCE(max_latency, 0), COALESCE(method, 'ANY'), COALESCE(error_codes, '[]'), created_at, owner_id
		FROM config_api_keys
		WHERE `+"`key`"+` = ? AND is_active = 1
	`, key).Scan(&c.ID, &c.Name, &c.Key, &c.IsActive, &c.TargetURL, &failRate, &c.MinLatency, &c.MaxLatency, &c.Method, &errorCodesJSON, &c.CreatedAt, &c.OwnerID)
	if err != nil {
		return nil, err
	}
	c.FailRate = int(failRate)
	if errorCodesJSON != "" && errorCodesJSON != "[]" {
		_ = json.Unmarshal([]byte(errorCodesJSON), &c.ErrorCodes)
	}
	if len(c.ErrorCodes) == 0 {
		c.ErrorCodes = []int{500, 503}
	}
	return c, nil
}

// InsertUsage records one request for a config key (for usage timeline).
// Returns error so callers can log (e.g. if usage_log table is missing).
func (r *Repository) InsertUsage(configKeyID int, requestedAt time.Time) error {
	_, err := r.db.Exec(
		`INSERT INTO usage_log (config_api_key_id, requested_at) VALUES (?, ?)`,
		configKeyID,
		requestedAt.UTC(),
	)
	return err
}
