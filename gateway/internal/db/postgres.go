package db

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool is the shared connection pool used across the gateway.
var Pool *pgxpool.Pool

// Connect initialises the PostgreSQL connection pool from environment variables.
// It retries up to 10 times with a 2-second delay to handle Docker startup ordering.
func Connect(ctx context.Context) error {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		os.Getenv("POSTGRES_HOST"),
		os.Getenv("POSTGRES_PORT"),
		os.Getenv("POSTGRES_USER"),
		os.Getenv("POSTGRES_PASSWORD"),
		os.Getenv("POSTGRES_DB"),
	)

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("db: parse config: %w", err)
	}

	config.MaxConns = 20
	config.MinConns = 2
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute

	const maxRetries = 10
	for i := 1; i <= maxRetries; i++ {
		pool, err := pgxpool.NewWithConfig(ctx, config)
		if err == nil {
			if pingErr := pool.Ping(ctx); pingErr == nil {
				Pool = pool
				fmt.Printf("[db] connected to PostgreSQL (attempt %d/%d)\n", i, maxRetries)
				return nil
			}
			pool.Close()
		}
		fmt.Printf("[db] waiting for PostgreSQL... (%d/%d): %v\n", i, maxRetries, err)
		time.Sleep(2 * time.Second)
	}

	return fmt.Errorf("db: could not connect after %d attempts", maxRetries)
}

// Close shuts down the connection pool gracefully.
func Close() {
	if Pool != nil {
		Pool.Close()
		fmt.Println("[db] connection pool closed")
	}
}
