#!/bin/bash

###############################################################################
# BARQ Fleet Management - Infrastructure Validation Script
#
# Validates the complete DevOps setup including:
# - Docker configuration
# - Environment files
# - Monitoring setup
# - CI/CD configuration
# - Documentation completeness
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASS++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL++))
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARN++))
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

log_info "BARQ Fleet Management - Infrastructure Validation"
log_info "Project root: $PROJECT_ROOT"
echo ""

# ============================================================================
# 1. Docker Configuration
# ============================================================================
log_section "1. Docker Configuration"

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    log_pass "Docker installed: $DOCKER_VERSION"
else
    log_fail "Docker not installed"
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    log_pass "Docker Compose installed: $COMPOSE_VERSION"
else
    log_fail "Docker Compose not installed"
fi

# Check Dockerfiles
[ -f "backend/Dockerfile" ] && log_pass "Backend Dockerfile exists" || log_fail "Backend Dockerfile missing"
[ -f "frontend/Dockerfile" ] && log_pass "Frontend Dockerfile exists" || log_fail "Frontend Dockerfile missing"

# Check .dockerignore
[ -f "backend/.dockerignore" ] && log_pass "Backend .dockerignore exists" || log_warn "Backend .dockerignore missing"
[ -f "frontend/.dockerignore" ] && log_pass "Frontend .dockerignore exists" || log_warn "Frontend .dockerignore missing"

# Check docker-compose.yml
if [ -f "docker-compose.yml" ]; then
    log_pass "docker-compose.yml exists"

    # Validate syntax
    if docker-compose config &> /dev/null; then
        log_pass "docker-compose.yml syntax valid"
    else
        log_fail "docker-compose.yml syntax invalid"
    fi

    # Check for required services
    for service in postgres redis backend frontend prometheus grafana; do
        if docker-compose config | grep -q "^  $service:"; then
            log_pass "Service defined: $service"
        else
            log_fail "Service missing: $service"
        fi
    done
else
    log_fail "docker-compose.yml missing"
fi

# ============================================================================
# 2. Environment Configuration
# ============================================================================
log_section "2. Environment Configuration"

# Check environment files
[ -f ".env.template" ] && log_pass ".env.template exists" || log_fail ".env.template missing"
[ -f ".env.development" ] && log_pass ".env.development exists" || log_warn ".env.development missing"
[ -f ".env.staging" ] && log_pass ".env.staging exists" || log_warn ".env.staging missing"
[ -f ".env.production.template" ] && log_pass ".env.production.template exists" || log_warn ".env.production.template missing"

# Check .env file
if [ -f ".env" ]; then
    log_pass ".env file exists"

    # Check required variables
    REQUIRED_VARS=("DB_PASSWORD" "JWT_SECRET" "JWT_REFRESH_SECRET")
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^$var=" .env; then
            log_pass "Environment variable set: $var"
        else
            log_warn "Environment variable missing: $var"
        fi
    done
else
    log_warn ".env file missing (copy from .env.template)"
fi

# ============================================================================
# 3. Deployment Scripts
# ============================================================================
log_section "3. Deployment Scripts"

SCRIPTS=("deploy.sh" "backup-db.sh" "restore-db.sh" "push-images.sh")
for script in "${SCRIPTS[@]}"; do
    if [ -f "scripts/$script" ]; then
        log_pass "Script exists: scripts/$script"

        # Check if executable
        if [ -x "scripts/$script" ]; then
            log_pass "Script is executable: $script"
        else
            log_warn "Script not executable: $script (run: chmod +x scripts/$script)"
        fi
    else
        log_fail "Script missing: scripts/$script"
    fi
done

# ============================================================================
# 4. Monitoring Configuration
# ============================================================================
log_section "4. Monitoring Configuration"

# Check Prometheus
if [ -f "monitoring/prometheus/prometheus.yml" ]; then
    log_pass "Prometheus config exists"
else
    log_fail "Prometheus config missing"
fi

if [ -f "monitoring/prometheus/alerts.yml" ]; then
    log_pass "Prometheus alerts exists"
else
    log_fail "Prometheus alerts missing"
fi

# Check Grafana
if [ -d "monitoring/grafana/provisioning" ]; then
    log_pass "Grafana provisioning directory exists"

    [ -f "monitoring/grafana/provisioning/datasources/prometheus.yml" ] && \
        log_pass "Grafana datasource config exists" || \
        log_warn "Grafana datasource config missing"

    [ -f "monitoring/grafana/provisioning/dashboards/dashboards.yml" ] && \
        log_pass "Grafana dashboard config exists" || \
        log_warn "Grafana dashboard config missing"
else
    log_fail "Grafana provisioning directory missing"
fi

# ============================================================================
# 5. CI/CD Configuration
# ============================================================================
log_section "5. CI/CD Configuration"

# Check GitHub Actions
if [ -d ".github/workflows" ]; then
    log_pass "GitHub workflows directory exists"

    [ -f ".github/workflows/ci.yml" ] && log_pass "CI workflow exists" || log_fail "CI workflow missing"
    [ -f ".github/workflows/cd-staging.yml" ] && log_pass "Staging CD workflow exists" || log_warn "Staging CD workflow missing"
    [ -f ".github/workflows/cd-production.yml" ] && log_pass "Production CD workflow exists" || log_warn "Production CD workflow missing"
else
    log_warn "GitHub workflows directory missing"
fi

# ============================================================================
# 6. Documentation
# ============================================================================
log_section "6. Documentation"

DOCS=("README.md" "INFRASTRUCTURE.md" "OPERATIONS_RUNBOOK.md" "API_DOCUMENTATION.md")
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        log_pass "Documentation exists: $doc"

        # Check if file is not empty
        if [ -s "$doc" ]; then
            WORD_COUNT=$(wc -w < "$doc")
            log_info "$doc: $WORD_COUNT words"
        else
            log_warn "$doc is empty"
        fi
    else
        [ "$doc" = "API_DOCUMENTATION.md" ] && log_warn "Documentation missing: $doc" || log_fail "Documentation missing: $doc"
    fi
done

# ============================================================================
# 7. Database Setup
# ============================================================================
log_section "7. Database Setup"

# Check schema files
[ -f "backend/src/database/schema-enhanced.sql" ] && \
    log_pass "Enhanced database schema exists" || \
    log_warn "Enhanced database schema missing"

[ -f "backend/src/database/schema.sql" ] && \
    log_pass "Basic database schema exists" || \
    log_fail "Basic database schema missing"

# Check backup directory
if [ -d "backend/database/backups" ]; then
    log_pass "Backup directory exists"
else
    log_warn "Backup directory missing (will be created on first backup)"
fi

# ============================================================================
# 8. Security Checks
# ============================================================================
log_section "8. Security Checks"

# Check .gitignore
if [ -f ".gitignore" ]; then
    log_pass ".gitignore exists"

    # Check for sensitive files in .gitignore
    SENSITIVE_FILES=(".env" "*.log" "node_modules" "*.pem" "*.key")
    for file in "${SENSITIVE_FILES[@]}"; do
        if grep -q "$file" .gitignore; then
            log_pass ".gitignore includes: $file"
        else
            log_warn ".gitignore missing: $file"
        fi
    done
else
    log_fail ".gitignore missing"
fi

# Check for committed secrets
if [ -d ".git" ]; then
    if git ls-files | grep -q "\.env$"; then
        log_fail ".env file is tracked by git (should be in .gitignore)"
    else
        log_pass ".env file not tracked by git"
    fi
fi

# ============================================================================
# 9. Directory Structure
# ============================================================================
log_section "9. Directory Structure"

REQUIRED_DIRS=("backend" "frontend" "scripts" "monitoring")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        log_pass "Directory exists: $dir"
    else
        log_fail "Directory missing: $dir"
    fi
done

# ============================================================================
# 10. Final Summary
# ============================================================================
log_section "Validation Summary"

TOTAL=$((PASS + FAIL + WARN))

echo ""
echo -e "${GREEN}Passed:${NC}  $PASS / $TOTAL"
echo -e "${RED}Failed:${NC}  $FAIL / $TOTAL"
echo -e "${YELLOW}Warnings:${NC} $WARN / $TOTAL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ Infrastructure validation PASSED${NC}"
    echo ""
    echo "Your BARQ Fleet Management infrastructure is ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "  1. Copy .env.template to .env and fill in values"
    echo "  2. Start the stack: docker-compose up -d"
    echo "  3. Check status: ./scripts/health-check.sh"
    echo "  4. Deploy: ./scripts/deploy.sh development"
    exit 0
else
    echo -e "${RED}✗ Infrastructure validation FAILED${NC}"
    echo ""
    echo "Please fix the $FAIL failed check(s) above before deploying."
    exit 1
fi
