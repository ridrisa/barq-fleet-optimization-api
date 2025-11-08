#!/bin/bash

###############################################################################
# BARQ Fleet Management - Database Backup Script
#
# This script creates a backup of the PostgreSQL database
# Backups are stored in backend/database/backups/ with timestamps
###############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
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

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backend/database/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/barq_db_backup_$TIMESTAMP.sql"

# Load environment
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | grep -v '^$' | xargs)
fi

DB_NAME=${DB_NAME:-barq_logistics}
DB_USER=${DB_USER:-barq_user}
CONTAINER_NAME=${1:-barq-postgres}

log_info "Starting database backup..."
log_info "Database: $DB_NAME"
log_info "Container: $CONTAINER_NAME"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    log_error "PostgreSQL container '$CONTAINER_NAME' is not running"
    log_error "Start it with: docker-compose up -d postgres"
    exit 1
fi

# Create backup
log_info "Creating backup: $BACKUP_FILE"
docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    log_error "Backup failed"
    exit 1
fi

log_success "Backup created: $BACKUP_FILE"

# Compress backup
log_info "Compressing backup..."
gzip "$BACKUP_FILE"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

log_success "Compressed: $COMPRESSED_FILE"

# Get file size
FILE_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
log_info "Backup size: $FILE_SIZE"

# Keep only last 10 backups
log_info "Cleaning old backups (keeping last 10)..."
cd "$BACKUP_DIR"
ls -t barq_db_backup_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f

BACKUP_COUNT=$(ls -1 barq_db_backup_*.sql.gz 2>/dev/null | wc -l)
log_info "Total backups: $BACKUP_COUNT"

log_success "Database backup complete!"
echo ""
echo "Backup location: $COMPRESSED_FILE"
echo "To restore this backup, run:"
echo "  ./scripts/restore-db.sh $COMPRESSED_FILE"
