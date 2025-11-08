#!/bin/bash

# ================================================================
# BARQ Fleet Management - Automated Security Audit Script
# ================================================================
# This script performs automated security checks and generates a report
#
# Usage: ./scripts/security-audit.sh [options]
# Options:
#   --full      Run full audit (including dependency scans)
#   --quick     Quick audit (basic checks only)
#   --ci        CI/CD mode (exit with non-zero on failures)
#
# ================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Configuration
AUDIT_MODE="${1:---quick}"
CI_MODE=false
if [ "$AUDIT_MODE" == "--ci" ]; then
    CI_MODE=true
    AUDIT_MODE="--full"
fi

# Output file
REPORT_FILE="security-audit-report-$(date +%Y%m%d-%H%M%S).txt"

# ================================================================
# Helper Functions
# ================================================================

log_section() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  $1${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
    echo "[PASS] $1" >> "$REPORT_FILE"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
    echo "[FAIL] $1" >> "$REPORT_FILE"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
    echo "[WARN] $1" >> "$REPORT_FILE"
}

# ================================================================
# Security Checks
# ================================================================

log_section "BARQ Fleet Management - Security Audit"

# Initialize report
echo "Security Audit Report - $(date)" > "$REPORT_FILE"
echo "Mode: $AUDIT_MODE" >> "$REPORT_FILE"
echo "=======================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# ----------------------------------------------------------------
# 1. Environment Configuration
# ----------------------------------------------------------------

log_section "1. Environment Configuration Checks"

# Check for .env file
if [ -f ".env" ]; then
    check_pass ".env file exists"

    # Check if .env is in .gitignore
    if grep -q "^\.env$" .gitignore 2>/dev/null; then
        check_pass ".env is in .gitignore"
    else
        check_fail ".env not in .gitignore - CRITICAL SECURITY ISSUE!"
    fi

    # Check for strong JWT secrets
    JWT_SECRET=$(grep -E "^JWT_SECRET=" .env 2>/dev/null | cut -d '=' -f2 | tr -d '"')
    if [ -n "$JWT_SECRET" ]; then
        if [ ${#JWT_SECRET} -ge 32 ]; then
            check_pass "JWT_SECRET is strong (${#JWT_SECRET} characters)"
        else
            check_fail "JWT_SECRET is weak (${#JWT_SECRET} characters) - should be 32+"
        fi
    else
        check_warn "JWT_SECRET not found in .env"
    fi

    # Check for default passwords
    if grep -qiE "(password.*=.*(changeme|password|admin|123456))" .env 2>/dev/null; then
        check_fail "Default/weak passwords detected in .env"
    else
        check_pass "No obvious default passwords in .env"
    fi

    # Check if NODE_ENV is production
    NODE_ENV=$(grep -E "^NODE_ENV=" .env 2>/dev/null | cut -d '=' -f2 | tr -d '"')
    if [ "$NODE_ENV" == "production" ]; then
        check_warn "NODE_ENV=production (ensure debug is disabled)"
    else
        check_pass "NODE_ENV is not production (development mode)"
    fi
else
    check_warn ".env file not found (using defaults or environment variables)"
fi

# ----------------------------------------------------------------
# 2. Dependency Vulnerabilities
# ----------------------------------------------------------------

log_section "2. Dependency Security Checks"

if [ "$AUDIT_MODE" == "--full" ]; then
    # Check Node.js dependencies
    if [ -f "package.json" ]; then
        echo "Running npm audit..."
        if npm audit --audit-level=high 2>&1 | tee -a "$REPORT_FILE" | grep -q "found 0 vulnerabilities"; then
            check_pass "No high/critical npm vulnerabilities found"
        else
            VULN_COUNT=$(npm audit --json 2>/dev/null | grep -o '"high":[0-9]*' | cut -d ':' -f2 || echo "0")
            if [ "$VULN_COUNT" -gt 0 ]; then
                check_fail "$VULN_COUNT high/critical npm vulnerabilities found"
            else
                check_warn "npm audit completed with warnings"
            fi
        fi
    fi

    # Check Python dependencies (if applicable)
    if [ -f "backend/optimization-service/requirements.txt" ]; then
        echo "Checking Python dependencies..."
        if command -v pip3 &> /dev/null; then
            cd backend/optimization-service
            if pip3 install --dry-run --report /dev/null -r requirements.txt 2>&1 | grep -qi "vulnerability"; then
                check_warn "Potential vulnerabilities in Python dependencies"
            else
                check_pass "Python dependencies checked"
            fi
            cd ../..
        else
            check_warn "pip3 not available - skipping Python dependency check"
        fi
    fi
else
    check_warn "Dependency scan skipped (use --full for complete audit)"
fi

# ----------------------------------------------------------------
# 3. File Permissions
# ----------------------------------------------------------------

log_section "3. File Permissions Checks"

# Check .env permissions
if [ -f ".env" ]; then
    ENV_PERMS=$(stat -f "%Lp" .env 2>/dev/null || stat -c "%a" .env 2>/dev/null)
    if [ "$ENV_PERMS" == "600" ] || [ "$ENV_PERMS" == "400" ]; then
        check_pass ".env file permissions are secure ($ENV_PERMS)"
    else
        check_fail ".env file permissions too permissive ($ENV_PERMS) - should be 600 or 400"
    fi
fi

# Check for world-writable files
WRITABLE_FILES=$(find . -type f -perm -002 2>/dev/null | grep -v ".git" | grep -v "node_modules" | wc -l)
if [ "$WRITABLE_FILES" -eq 0 ]; then
    check_pass "No world-writable files found"
else
    check_warn "$WRITABLE_FILES world-writable files found"
fi

# ----------------------------------------------------------------
# 4. Secrets Detection
# ----------------------------------------------------------------

log_section "4. Secrets & Credentials Detection"

# Check for hardcoded secrets (basic patterns)
PATTERNS=(
    "password.*=.*['\"][a-zA-Z0-9]+"
    "api_key.*=.*['\"][a-zA-Z0-9]+"
    "secret.*=.*['\"][a-zA-Z0-9]+"
    "token.*=.*['\"][a-zA-Z0-9]+"
    "-----BEGIN RSA PRIVATE KEY-----"
    "-----BEGIN PRIVATE KEY-----"
)

SECRET_FOUND=false
for pattern in "${PATTERNS[@]}"; do
    if grep -rE "$pattern" backend/src --include="*.js" --exclude-dir=node_modules 2>/dev/null | grep -v "process.env" | grep -q .; then
        SECRET_FOUND=true
        check_fail "Potential hardcoded secret found (pattern: ${pattern:0:30}...)"
    fi
done

if [ "$SECRET_FOUND" = false ]; then
    check_pass "No obvious hardcoded secrets in source code"
fi

# Check for AWS credentials
if grep -rE "(AKIA[0-9A-Z]{16})" backend/src --include="*.js" 2>/dev/null | grep -q .; then
    check_fail "AWS Access Key ID found in source code!"
else
    check_pass "No AWS credentials in source code"
fi

# ----------------------------------------------------------------
# 5. Security Headers
# ----------------------------------------------------------------

log_section "5. Security Headers Check (Runtime)"

# Check if backend is running
if curl -s http://localhost:3003/api/v1/health > /dev/null 2>&1; then
    HEADERS=$(curl -s -I http://localhost:3003/api/v1/health)

    # Check for security headers
    if echo "$HEADERS" | grep -qi "X-Content-Type-Options: nosniff"; then
        check_pass "X-Content-Type-Options header present"
    else
        check_fail "X-Content-Type-Options header missing"
    fi

    if echo "$HEADERS" | grep -qi "X-Frame-Options"; then
        check_pass "X-Frame-Options header present"
    else
        check_warn "X-Frame-Options header missing"
    fi

    if echo "$HEADERS" | grep -qi "Strict-Transport-Security"; then
        check_pass "HSTS header present"
    else
        check_warn "HSTS header missing (ok for development)"
    fi

    if echo "$HEADERS" | grep -qi "Content-Security-Policy"; then
        check_pass "Content-Security-Policy header present"
    else
        check_warn "Content-Security-Policy header missing"
    fi

    # Check for information disclosure
    if echo "$HEADERS" | grep -qi "X-Powered-By"; then
        check_warn "X-Powered-By header exposes technology stack"
    else
        check_pass "X-Powered-By header not present"
    fi
else
    check_warn "Backend not running - skipping runtime header checks"
fi

# ----------------------------------------------------------------
# 6. Code Security Patterns
# ----------------------------------------------------------------

log_section "6. Code Security Patterns"

# Check for eval() usage
if grep -rn "eval(" backend/src --include="*.js" 2>/dev/null | grep -q .; then
    check_fail "eval() usage detected - dangerous!"
else
    check_pass "No eval() usage found"
fi

# Check for exec/execSync usage
if grep -rn "exec\(|execSync(" backend/src --include="*.js" 2>/dev/null | grep -q .; then
    check_warn "exec()/execSync() usage detected - review for command injection"
else
    check_pass "No direct exec() usage found"
fi

# Check for process.env in client-side code (if frontend exists)
if [ -d "frontend/src" ]; then
    if grep -rn "process.env" frontend/src --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "NEXT_PUBLIC" | grep -q .; then
        check_warn "process.env usage in frontend (ensure not exposing secrets)"
    else
        check_pass "No suspicious process.env in frontend"
    fi
fi

# Check for SQL concatenation (potential SQL injection)
if grep -rn 'query.*".*\+' backend/src --include="*.js" 2>/dev/null | grep -q .; then
    check_warn "Potential SQL string concatenation detected - use parameterized queries"
else
    check_pass "No obvious SQL concatenation found"
fi

# ----------------------------------------------------------------
# 7. Docker Security
# ----------------------------------------------------------------

log_section "7. Docker Security"

# Check if running as root in Dockerfile
if [ -f "backend/Dockerfile" ]; then
    if grep -q "USER node" backend/Dockerfile; then
        check_pass "Backend Dockerfile uses non-root user"
    else
        check_warn "Backend Dockerfile may run as root"
    fi
fi

if [ -f "frontend/Dockerfile" ]; then
    if grep -q "USER node" frontend/Dockerfile; then
        check_pass "Frontend Dockerfile uses non-root user"
    else
        check_warn "Frontend Dockerfile may run as root"
    fi
fi

# Check for latest tag usage
if grep -rE "FROM.*:latest" --include="Dockerfile" --include="docker-compose*.yml" . 2>/dev/null | grep -q .; then
    check_warn "Using ':latest' tag in Docker images - use specific versions"
else
    check_pass "Docker images use specific versions"
fi

# ----------------------------------------------------------------
# 8. Database Security
# ----------------------------------------------------------------

log_section "8. Database Security"

# Check for default database passwords
if [ -f ".env" ]; then
    DB_PASSWORD=$(grep -E "^(DB_PASSWORD|POSTGRES_PASSWORD)=" .env 2>/dev/null | cut -d '=' -f2 | tr -d '"')
    if [ -n "$DB_PASSWORD" ]; then
        if [ "$DB_PASSWORD" == "postgres" ] || [ "$DB_PASSWORD" == "password" ] || [ "$DB_PASSWORD" == "changeme" ]; then
            check_fail "Default database password detected - CRITICAL!"
        else
            if [ ${#DB_PASSWORD} -ge 16 ]; then
                check_pass "Database password appears strong"
            else
                check_warn "Database password is short (${#DB_PASSWORD} chars) - recommend 16+"
            fi
        fi
    fi
fi

# Check for database SSL
if [ -f ".env" ]; then
    if grep -qE "^POSTGRES_SSL=true" .env 2>/dev/null; then
        check_pass "PostgreSQL SSL enabled"
    else
        check_warn "PostgreSQL SSL not explicitly enabled"
    fi
fi

# ----------------------------------------------------------------
# 9. Rate Limiting
# ----------------------------------------------------------------

log_section "9. Rate Limiting Configuration"

# Check if rate limiting is configured
if grep -rq "rate-limit" backend/src --include="*.js"; then
    check_pass "Rate limiting code found"

    # Check rate limit values
    if grep -rE "max.*:.*[0-9]+" backend/src --include="*.js" | grep -q "rate-limit"; then
        check_pass "Rate limits configured"
    fi
else
    check_warn "No rate limiting implementation found"
fi

# ----------------------------------------------------------------
# 10. CORS Configuration
# ----------------------------------------------------------------

log_section "10. CORS Configuration"

# Check for permissive CORS
if grep -rE "origin.*:.*['\"]\\*['\"]" backend/src --include="*.js" 2>/dev/null | grep -q .; then
    check_fail "Permissive CORS detected (origin: '*') - security risk!"
else
    check_pass "No permissive CORS configuration found"
fi

# ================================================================
# Generate Summary
# ================================================================

echo "" | tee -a "$REPORT_FILE"
log_section "Security Audit Summary"

echo -e "${GREEN}Passed:${NC}   $PASSED" | tee -a "$REPORT_FILE"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS" | tee -a "$REPORT_FILE"
echo -e "${RED}Failed:${NC}   $FAILED" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Calculate score
TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
    SCORE=$((PASSED * 100 / TOTAL))
    echo -e "Security Score: ${GREEN}${SCORE}%${NC}" | tee -a "$REPORT_FILE"
else
    SCORE=0
fi

echo "" | tee -a "$REPORT_FILE"
echo "Detailed report saved to: $REPORT_FILE"

# ================================================================
# Recommendations
# ================================================================

if [ $FAILED -gt 0 ] || [ $WARNINGS -gt 5 ]; then
    echo ""
    log_section "Recommendations"

    if [ $FAILED -gt 0 ]; then
        echo -e "${RED}CRITICAL:${NC} $FAILED critical security issues found!"
        echo "  1. Review all FAIL items above immediately"
        echo "  2. Fix critical issues before deployment"
        echo "  3. Re-run audit after fixes"
    fi

    if [ $WARNINGS -gt 5 ]; then
        echo -e "${YELLOW}WARNING:${NC} $WARNINGS warnings found"
        echo "  1. Review WARN items for potential improvements"
        echo "  2. Prioritize high-risk warnings"
        echo "  3. Document accepted risks"
    fi
fi

# ================================================================
# Exit Code
# ================================================================

if [ "$CI_MODE" = true ]; then
    if [ $FAILED -gt 0 ]; then
        echo ""
        echo "Security audit FAILED in CI mode - exiting with error"
        exit 1
    elif [ $WARNINGS -gt 10 ]; then
        echo ""
        echo "Too many warnings in CI mode - exiting with error"
        exit 1
    fi
fi

if [ $SCORE -ge 80 ]; then
    echo -e "\n${GREEN}✓ Security audit completed successfully${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠ Security audit completed with issues${NC}"
    exit 0
fi
