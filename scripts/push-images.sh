#!/bin/bash

###############################################################################
# BARQ Fleet Management - Docker Image Push Script
#
# Pushes built Docker images to a container registry
# Supports: Docker Hub, GitHub Container Registry, Google Container Registry
#
# Usage: ./scripts/push-images.sh [registry] [repo] [version]
# Example: ./scripts/push-images.sh ghcr.io barq/fleet-management v1.2.0
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
REGISTRY=${1:-ghcr.io}
REPO=${2:-barq/fleet-management}
VERSION=${3:-latest}

log_info "Docker Image Push Configuration"
log_info "Registry: $REGISTRY"
log_info "Repository: $REPO"
log_info "Version: $VERSION"

# Check if images exist
if ! docker images | grep -q "barq-backend"; then
    log_error "Backend image not found. Build it first with: docker-compose build"
    exit 1
fi

if ! docker images | grep -q "barq-frontend"; then
    log_error "Frontend image not found. Build it first with: docker-compose build"
    exit 1
fi

# Tag images
log_info "Tagging images..."

docker tag barq-backend:latest "$REGISTRY/$REPO/backend:$VERSION"
docker tag barq-backend:latest "$REGISTRY/$REPO/backend:latest"
log_success "Tagged backend image"

docker tag barq-frontend:latest "$REGISTRY/$REPO/frontend:$VERSION"
docker tag barq-frontend:latest "$REGISTRY/$REPO/frontend:latest"
log_success "Tagged frontend image"

# Push images
log_info "Pushing images to registry..."

log_info "Pushing backend:$VERSION..."
docker push "$REGISTRY/$REPO/backend:$VERSION"

log_info "Pushing backend:latest..."
docker push "$REGISTRY/$REPO/backend:latest"

log_info "Pushing frontend:$VERSION..."
docker push "$REGISTRY/$REPO/frontend:$VERSION"

log_info "Pushing frontend:latest..."
docker push "$REGISTRY/$REPO/frontend:latest"

log_success "All images pushed successfully!"
echo ""
echo "Images available at:"
echo "  $REGISTRY/$REPO/backend:$VERSION"
echo "  $REGISTRY/$REPO/backend:latest"
echo "  $REGISTRY/$REPO/frontend:$VERSION"
echo "  $REGISTRY/$REPO/frontend:latest"
