#!/bin/bash

###############################################################################
# BARQ Fleet Management - Deployment Script
#
# Usage: ./scripts/deploy.sh [environment] [version]
#   environment: development, staging, or production
#   version: Docker image tag (default: latest)
#
# Example: ./scripts/deploy.sh staging v1.2.0
###############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
ENVIRONMENT=${1:-}
VERSION=${2:-latest}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Validate environment
if [ -z "$ENVIRONMENT" ]; then
    log_error "Usage: ./scripts/deploy.sh [development|staging|production] [version]"
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    log_error "Must be one of: development, staging, production"
    exit 1
fi

log_info "Starting deployment to $ENVIRONMENT"
log_info "Version: $VERSION"
log_info "Project root: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# Load environment-specific variables
ENV_FILE=".env.$ENVIRONMENT"
if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found: $ENV_FILE"
    log_error "Please create it from .env.template"
    exit 1
fi

log_info "Loading environment from $ENV_FILE"
export $(cat "$ENV_FILE" | grep -v '^#' | grep -v '^$' | xargs)

# Production safety check
if [ "$ENVIRONMENT" = "production" ]; then
    log_warning "⚠️  PRODUCTION DEPLOYMENT ⚠️"
    echo ""
    echo "You are about to deploy to PRODUCTION."
    echo "This will affect live users."
    echo ""
    read -p "Type 'DEPLOY' to continue: " -r
    echo ""
    if [[ ! $REPLY = "DEPLOY" ]]; then
        log_error "Deployment cancelled"
        exit 1
    fi
fi

# Pre-deployment checks
log_info "Running pre-deployment checks..."

# Check Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose is not installed"
    exit 1
fi

# Check required environment variables
REQUIRED_VARS=(
    "DB_PASSWORD"
    "JWT_SECRET"
    "JWT_REFRESH_SECRET"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        log_error "Required environment variable not set: $var"
        exit 1
    fi
done

log_success "Pre-deployment checks passed"

# Stop existing containers
log_info "Stopping existing containers..."
docker-compose down || true

# Build Docker images
log_info "Building Docker images..."
docker-compose build --no-cache \
    --build-arg BUILD_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    --build-arg VERSION="$VERSION"

log_success "Docker images built successfully"

# Run database migrations (if needed)
if [ -f "$PROJECT_ROOT/backend/scripts/migrate-data.js" ]; then
    log_info "Running database migrations..."
    docker-compose run --rm backend npm run db:migrate || log_warning "Migration command not available"
fi

# Start services
log_info "Starting services..."
docker-compose up -d

log_info "Waiting for services to be healthy..."

# Wait for backend health check
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -f http://localhost:3003/health &> /dev/null; then
        log_success "Backend is healthy"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        log_error "Backend failed to become healthy"
        docker-compose logs backend
        exit 1
    fi
    echo -n "."
    sleep 2
done
echo ""

# Wait for frontend health check
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -f http://localhost:3001/ &> /dev/null; then
        log_success "Frontend is healthy"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        log_error "Frontend failed to become healthy"
        docker-compose logs frontend
        exit 1
    fi
    echo -n "."
    sleep 2
done
echo ""

# Verify deployment
log_info "Verifying deployment..."

# Check all services are running
SERVICES=("postgres" "redis" "backend" "frontend" "prometheus" "grafana")
for service in "${SERVICES[@]}"; do
    if docker-compose ps "$service" | grep -q "Up"; then
        log_success "$service is running"
    else
        log_error "$service is not running"
        docker-compose logs "$service"
        exit 1
    fi
done

# Display service URLs
echo ""
log_success "🚀 Deployment complete!"
echo ""
echo "Services are running at:"
echo "  Backend API:    http://localhost:3003"
echo "  Frontend:       http://localhost:3001"
echo "  Grafana:        http://localhost:3000 (admin/${GRAFANA_PASSWORD:-admin})"
echo "  Prometheus:     http://localhost:9090"
echo "  PostgreSQL:     localhost:5432"
echo "  Redis:          localhost:6379"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop services:"
echo "  docker-compose down"
echo ""

# Post-deployment smoke tests
log_info "Running smoke tests..."

# Test API endpoint
if curl -f http://localhost:3003/health | grep -q "ok"; then
    log_success "API health check passed"
else
    log_error "API health check failed"
    exit 1
fi

log_success "All smoke tests passed"
log_success "Deployment completed successfully!"
