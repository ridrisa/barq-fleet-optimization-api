#!/bin/bash

# BARQ Fleet Management - Environment File Consolidation Script
# Security Specialist - 2025-11-11
#
# This script safely consolidates 19 .env files down to secure templates
# and removes sensitive credentials from git tracking.
#
# IMPORTANT: Review SECURITY_AUDIT_REPORT.md before running!

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="/Users/ramiz_new/Desktop/AI-Route-Optimization-API"
BACKUP_DIR="$PROJECT_ROOT/.env-backup-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}BARQ Fleet - Environment Consolidation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Confirmation
echo -e "${YELLOW}WARNING: This script will:${NC}"
echo "  1. Backup all existing .env files"
echo "  2. Remove redundant .env files from git tracking"
echo "  3. Delete files with exposed credentials"
echo "  4. Create .env.local templates from examples"
echo ""
echo -e "${RED}CRITICAL: Ensure you have rotated all exposed credentials first!${NC}"
echo "  - GROQ API Key"
echo "  - AWS RDS Password"
echo "  - Mapbox Token"
echo ""
read -p "Have you rotated all credentials? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${RED}Aborted. Please rotate credentials first.${NC}"
    exit 1
fi

echo ""
read -p "Continue with consolidation? (yes/no): " CONFIRM2

if [ "$CONFIRM2" != "yes" ]; then
    echo -e "${YELLOW}Aborted by user.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}Starting consolidation...${NC}"
echo ""

# Step 1: Create backup directory
echo -e "${BLUE}[1/7] Creating backup...${NC}"
mkdir -p "$BACKUP_DIR"

# Backup all .env files
find "$PROJECT_ROOT" -name ".env*" -type f -exec cp --parents {} "$BACKUP_DIR" \;

echo -e "${GREEN}✓ Backup created at: $BACKUP_DIR${NC}"
echo ""

# Step 2: Remove redundant files from git tracking
echo -e "${BLUE}[2/7] Removing redundant files from git tracking...${NC}"

cd "$PROJECT_ROOT"

git rm --cached .env.development 2>/dev/null || echo "  .env.development not tracked"
git rm --cached .env.production 2>/dev/null || echo "  .env.production not tracked"
git rm --cached .env.staging 2>/dev/null || echo "  .env.staging not tracked"
git rm --cached frontend/.env.development 2>/dev/null || echo "  frontend/.env.development not tracked"
git rm --cached frontend/.env.production 2>/dev/null || echo "  frontend/.env.production already removed"
git rm --cached frontend/.env.staging 2>/dev/null || echo "  frontend/.env.staging not tracked"

echo -e "${GREEN}✓ Files removed from git tracking${NC}"
echo ""

# Step 3: Delete redundant root .env files
echo -e "${BLUE}[3/7] Deleting redundant root .env files...${NC}"

rm -f "$PROJECT_ROOT/.env.development"
rm -f "$PROJECT_ROOT/.env.production"
rm -f "$PROJECT_ROOT/.env.staging"
rm -f "$PROJECT_ROOT/.env.template"

echo -e "${GREEN}✓ Removed 4 redundant root files${NC}"
echo ""

# Step 4: Delete sensitive backend files
echo -e "${BLUE}[4/7] Deleting sensitive backend files...${NC}"

# CRITICAL: Files with real credentials
if [ -f "$PROJECT_ROOT/backend/.env.migration" ]; then
    echo -e "${RED}  Deleting backend/.env.migration (contains AWS RDS credentials)${NC}"
    rm -f "$PROJECT_ROOT/backend/.env.migration"
fi

if [ -f "$PROJECT_ROOT/backend/.env.aws-rds" ]; then
    echo "  Deleting backend/.env.aws-rds"
    rm -f "$PROJECT_ROOT/backend/.env.aws-rds"
fi

echo -e "${GREEN}✓ Deleted sensitive backend files${NC}"
echo ""

# Step 5: Delete redundant frontend files
echo -e "${BLUE}[5/7] Deleting redundant frontend files...${NC}"

rm -f "$PROJECT_ROOT/frontend/.env.development"
rm -f "$PROJECT_ROOT/frontend/.env.production"
rm -f "$PROJECT_ROOT/frontend/.env.staging"

echo -e "${GREEN}✓ Removed 3 redundant frontend files${NC}"
echo ""

# Step 6: Create .env.local templates (if they don't exist)
echo -e "${BLUE}[6/7] Creating .env.local templates...${NC}"

# Root .env.local
if [ ! -f "$PROJECT_ROOT/.env.local" ] && [ -f "$PROJECT_ROOT/.env.example" ]; then
    echo "  Creating root .env.local from .env.example"
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env.local"
fi

# Backend .env.local
if [ ! -f "$PROJECT_ROOT/backend/.env.local" ] && [ -f "$PROJECT_ROOT/backend/.env.example" ]; then
    echo "  Creating backend/.env.local from .env.example"
    cp "$PROJECT_ROOT/backend/.env.example" "$PROJECT_ROOT/backend/.env.local"
fi

# Backend optimization-service .env.local
if [ ! -f "$PROJECT_ROOT/backend/optimization-service/.env.local" ] && [ -f "$PROJECT_ROOT/backend/optimization-service/.env.example" ]; then
    echo "  Creating backend/optimization-service/.env.local"
    cp "$PROJECT_ROOT/backend/optimization-service/.env.example" "$PROJECT_ROOT/backend/optimization-service/.env.local"
fi

# Frontend .env.local
if [ ! -f "$PROJECT_ROOT/frontend/.env.local" ] && [ -f "$PROJECT_ROOT/frontend/.env.example" ]; then
    echo "  Creating frontend/.env.local from .env.example"
    cp "$PROJECT_ROOT/frontend/.env.example" "$PROJECT_ROOT/frontend/.env.local"
fi

# Analytics .env.local
if [ ! -f "$PROJECT_ROOT/gpt-fleet-optimizer/.env.local" ] && [ -f "$PROJECT_ROOT/gpt-fleet-optimizer/.env.example" ]; then
    echo "  Creating gpt-fleet-optimizer/.env.local"
    cp "$PROJECT_ROOT/gpt-fleet-optimizer/.env.example" "$PROJECT_ROOT/gpt-fleet-optimizer/.env.local"
fi

echo -e "${GREEN}✓ Created .env.local templates${NC}"
echo ""

# Step 7: Verify .gitignore
echo -e "${BLUE}[7/7] Verifying .gitignore configuration...${NC}"

# Check if .env.local files are ignored
git check-ignore .env.local >/dev/null 2>&1 && echo -e "${GREEN}  ✓ .env.local is ignored${NC}" || echo -e "${RED}  ✗ .env.local NOT ignored${NC}"
git check-ignore backend/.env.local >/dev/null 2>&1 && echo -e "${GREEN}  ✓ backend/.env.local is ignored${NC}" || echo -e "${RED}  ✗ backend/.env.local NOT ignored${NC}"
git check-ignore frontend/.env.local >/dev/null 2>&1 && echo -e "${GREEN}  ✓ frontend/.env.local is ignored${NC}" || echo -e "${RED}  ✗ frontend/.env.local NOT ignored${NC}"

# Check if .env is ignored
git check-ignore .env >/dev/null 2>&1 && echo -e "${GREEN}  ✓ .env is ignored${NC}" || echo -e "${RED}  ✗ .env NOT ignored${NC}"

echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Consolidation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "  • Backup location: $BACKUP_DIR"
echo "  • Files removed from git: 6"
echo "  • Files deleted: 9"
echo "  • .env.local files created: 5"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Review changes: git status"
echo "  2. Edit .env.local files with your local credentials"
echo "  3. Test all services: npm run dev"
echo "  4. Commit changes: git commit -m 'Security: Consolidate environment files'"
echo "  5. Rotate exposed credentials:"
echo "     - GROQ API Key: https://console.groq.com/keys"
echo "     - AWS RDS Password: AWS Console"
echo "     - Mapbox Token: https://account.mapbox.com/access-tokens/"
echo ""
echo -e "${BLUE}Remaining .env Files:${NC}"
find "$PROJECT_ROOT" -name ".env*" -type f | grep -v node_modules | grep -v .env-backup | sort
echo ""
echo -e "${GREEN}Done!${NC}"
