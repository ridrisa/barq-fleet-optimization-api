#!/bin/bash

###############################################################################
# BARQ Fleet Management - Database Restore Script
#
# Usage: ./scripts/restore-db.sh <backup-file>
# Example: ./scripts/restore-db.sh backend/database/backups/barq_db_backup_20250105_120000.sql.gz
###############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_FILE=${1:-}
CONTAINER_NAME=${2:-barq-postgres}

# Load environment
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | grep -v '^$' | xargs)
fi

DB_NAME=${DB_NAME:-barq_logistics}
DB_USER=${DB_USER:-barq_user}

# Validate arguments
if [ -z "$BACKUP_FILE" ]; then
    log_error "Usage: ./scripts/restore-db.sh <backup-file>"
    echo ""
    echo "Available backups:"
    ls -lh "$PROJECT_ROOT/backend/database/backups/"*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

log_warning "⚠️  DATABASE RESTORE WARNING ⚠️"
echo ""
echo "You are about to restore the database from:"
echo "  $BACKUP_FILE"
echo ""
echo "This will:"
echo "  1. DROP the existing database '$DB_NAME'"
echo "  2. Recreate it from the backup"
echo "  3. ALL CURRENT DATA WILL BE LOST"
echo ""
read -p "Type 'RESTORE' to continue: " -r
echo ""

if [[ ! $REPLY = "RESTORE" ]]; then
    log_error "Restore cancelled"
    exit 1
fi

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    log_error "PostgreSQL container '$CONTAINER_NAME' is not running"
    log_error "Start it with: docker-compose up -d postgres"
    exit 1
fi

# Decompress if needed
TEMP_FILE=""
if [[ $BACKUP_FILE == *.gz ]]; then
    log_info "Decompressing backup..."
    TEMP_FILE="${BACKUP_FILE%.gz}.tmp"
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    SQL_FILE="$TEMP_FILE"
else
    SQL_FILE="$BACKUP_FILE"
fi

log_info "Stopping application services..."
docker-compose stop backend frontend 2>/dev/null || true

log_info "Dropping existing database..."
docker exec -t "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" || true

log_info "Creating new database..."
docker exec -t "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"

log_info "Restoring database from backup..."
cat "$SQL_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"

if [ $? -ne 0 ]; then
    log_error "Database restore failed"
    [ -n "$TEMP_FILE" ] && rm -f "$TEMP_FILE"
    exit 1
fi

# Clean up temp file
[ -n "$TEMP_FILE" ] && rm -f "$TEMP_FILE"

log_success "Database restored successfully"

log_info "Restarting application services..."
docker-compose start backend frontend

log_info "Waiting for services to be ready..."
sleep 5

# Verify database
log_info "Verifying database..."
TABLES=$(docker exec -t "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
log_info "Found $TABLES tables in restored database"

log_success "Database restore complete!"
echo ""
echo "Services status:"
docker-compose ps
