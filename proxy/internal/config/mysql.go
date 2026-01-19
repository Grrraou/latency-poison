package config

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

// MySQLClient wraps the MySQL database connection
type MySQLClient struct {
	db *sql.DB
}

// NewMySQLClient creates a new MySQL database connection
func NewMySQLClient() (*MySQLClient, error) {
	host := os.Getenv("DATABASE_HOST")
	if host == "" {
		host = "localhost"
	}

	port := os.Getenv("DATABASE_PORT")
	if port == "" {
		port = "3306"
	}

	user := os.Getenv("DATABASE_USER")
	if user == "" {
		user = "latencypoison"
	}

	password := os.Getenv("DATABASE_PASSWORD")
	if password == "" {
		password = "latencypoison"
	}

	dbName := os.Getenv("DATABASE_NAME")
	if dbName == "" {
		dbName = "latencypoison"
	}

	// MySQL DSN format: user:password@tcp(host:port)/dbname?parseTime=true
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci",
		user, password, host, port, dbName)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Test the connection with retries
	var pingErr error
	for i := 0; i < 30; i++ {
		pingErr = db.Ping()
		if pingErr == nil {
			break
		}
		time.Sleep(1 * time.Second)
	}

	if pingErr != nil {
		return nil, fmt.Errorf("failed to ping database after retries: %w", pingErr)
	}

	return &MySQLClient{db: db}, nil
}

// GetDB returns the underlying database connection
func (c *MySQLClient) GetDB() *sql.DB {
	return c.db
}

// Close closes the database connection
func (c *MySQLClient) Close() error {
	return c.db.Close()
}
