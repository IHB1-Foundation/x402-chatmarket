# Infrastructure Setup

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)

## Quick Start

```bash
# Start all services
cd infra
docker compose up -d

# Verify services are running
docker compose ps

# Check postgres with pgvector
docker compose exec postgres psql -U soulforge -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"

# Check redis
docker compose exec redis redis-cli ping
```

## Services

### PostgreSQL with pgvector
- Image: `pgvector/pgvector:pg16`
- Default port: `5432`
- Default credentials:
  - User: `soulforge`
  - Password: `soulforge_dev`
  - Database: `soulforge`
- Connection string: `postgresql://soulforge:soulforge_dev@localhost:5432/soulforge`

### Redis
- Image: `redis:7-alpine`
- Default port: `6379`
- Connection string: `redis://localhost:6379`

## Environment Variables

You can customize the services by setting environment variables:

```bash
# .env file in infra/ directory
POSTGRES_USER=custom_user
POSTGRES_PASSWORD=custom_password
POSTGRES_DB=custom_db
POSTGRES_PORT=5433
REDIS_PORT=6380
```

## Stopping Services

```bash
# Stop services (keeps data)
docker compose stop

# Stop and remove containers (keeps data volumes)
docker compose down

# Stop and remove everything including data
docker compose down -v
```
