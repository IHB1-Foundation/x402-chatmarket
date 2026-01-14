#!/bin/bash
# Migration runner script
# Usage: ./run.sh [DATABASE_URL]

set -e

DATABASE_URL="${1:-${DATABASE_URL:-postgresql://soulforge:soulforge_dev@localhost:5432/soulforge}}"

echo "Running migrations against: $DATABASE_URL"

# Run all SQL files in order
for file in $(ls -1 *.sql | sort); do
    echo "Running migration: $file"
    psql "$DATABASE_URL" -f "$file"
    echo "Completed: $file"
done

echo "All migrations completed successfully!"
