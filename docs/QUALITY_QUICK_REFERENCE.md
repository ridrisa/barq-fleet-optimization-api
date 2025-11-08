# Code Quality Quick Reference

**Quick guide for maintaining code quality in the AI-Powered Logistics Optimization Platform**

---

## One-Command Quality Checks

### Backend
```bash
cd backend

# ✅ Check everything (lint + format)
npm run quality

# 🔧 Fix everything automatically
npm run quality:fix

# 📝 Individual commands
npm run lint          # Check linting
npm run lint:fix      # Fix linting issues
npm run format        # Format all code
npm run format:check  # Check formatting only
```

### Frontend
```bash
cd frontend

# ✅ Check everything (lint + format)
npm run quality

# 🔧 Fix everything automatically
npm run quality:fix

# 📝 Individual commands
npm run lint:eslint   # Check linting
npm run lint:fix      # Fix linting issues
npm run format        # Format all code
npm run format:check  # Check formatting only
```

---

## Pre-Commit Workflow

**Every time before committing:**

```bash
# 1. Auto-fix everything
cd backend && npm run quality:fix
cd ../frontend && npm run quality:fix

# 2. Check for remaining issues
cd backend && npm run quality
cd ../frontend && npm run quality

# 3. Fix any critical errors manually

# 4. Commit
git add .
git commit -m "Your message"
```

---

## Using Constants

**Instead of magic numbers:**
```javascript
// ❌ BAD - Magic numbers
const timeout = 5000;
const maxRetries = 3;
const threshold = 0.8;

// ✅ GOOD - Use constants
const { PERFORMANCE, AGENT, SCALING } = require('./config/constants');

const timeout = PERFORMANCE.MAX_QUERY_TIME_MS;
const maxRetries = AGENT.MAX_RETRIES;
const threshold = SCALING.SCALE_UP_THRESHOLD;
```

**Available constant categories:**
- `GEO` - Geographic constants
- `TIME` - Time-related values
- `CLUSTERING` - Clustering parameters
- `BATCHING` - Batch configuration
- `VEHICLE` - Vehicle specs
- `SLA` - Service level agreements
- `ROUTE` - Route optimization
- `COST` - Cost calculations
- `PERFORMANCE` - Performance limits
- `PAGINATION` - Pagination defaults
- `VALIDATION` - Validation rules
- `AGENT` - Agent configuration
- `PRIORITY` - Priority levels
- `STATUS` - Status codes
- `ORDER_TYPE` - Order types
- `ALERT` - Alert levels
- `DATABASE` - Database config
- `CIRCUIT_BREAKER` - Circuit breaker
- `RATE_LIMIT` - Rate limiting
- `LOG` - Logging config
- `SCALING` - Scaling thresholds
- `PRECISION` - Decimal precision
- `DEFAULTS` - Default values

---

## Common Issues & Fixes

### Issue: "no-magic-numbers"
```javascript
// ❌ Error
const result = value * 100;

// ✅ Fix
const { VALIDATION } = require('./config/constants');
const result = value * VALIDATION.MAX_ARRAY_LENGTH;
```

### Issue: "complexity too high"
```javascript
// ❌ Bad - Complexity 15
function processOrder(order) {
  if (order.type === 'BARQ') {
    if (order.urgent) {
      if (order.distance > 10) {
        // ... more nested logic
      }
    }
  }
  // etc...
}

// ✅ Good - Extract helper functions
function processOrder(order) {
  if (isBarqOrder(order)) {
    return processBARQOrder(order);
  }
  return processStandardOrder(order);
}

function isBarqOrder(order) {
  return order.type === 'BARQ';
}

function processBARQOrder(order) {
  if (isUrgentOrder(order)) {
    return processUrgentOrder(order);
  }
  return processNormalOrder(order);
}
```

### Issue: "max-lines-per-function"
```javascript
// ❌ Bad - 80 lines in one function
async function processEverything(data) {
  // ... 80 lines of code
}

// ✅ Good - Split into smaller functions
async function processEverything(data) {
  const validated = await validateData(data);
  const enriched = await enrichData(validated);
  const processed = await processData(enriched);
  return await saveResults(processed);
}

async function validateData(data) {
  // ... 15 lines
}

async function enrichData(data) {
  // ... 20 lines
}

async function processData(data) {
  // ... 25 lines
}

async function saveResults(data) {
  // ... 15 lines
}
```

### Issue: "no-console"
```javascript
// ❌ Bad
console.log('Processing order:', orderId);

// ✅ Good
const { logger } = require('./utils/logger');
logger.info('Processing order', { orderId });
```

### Issue: "@typescript-eslint/no-explicit-any"
```typescript
// ❌ Bad
function processData(data: any): any {
  return data;
}

// ✅ Good
interface InputData {
  id: string;
  value: number;
}

interface OutputData {
  id: string;
  result: string;
}

function processData(data: InputData): OutputData {
  return {
    id: data.id,
    result: data.value.toString()
  };
}
```

---

## JSDoc Template

**For all public functions:**
```javascript
/**
 * Brief description of what this function does
 *
 * @param {string} param1 - Description of param1
 * @param {number} param2 - Description of param2
 * @param {Object} options - Configuration options
 * @param {boolean} [options.flag=false] - Optional parameter with default
 * @returns {Promise<Object>} Description of return value
 * @throws {Error} When validation fails
 *
 * @example
 * const result = await myFunction('test', 42, { flag: true });
 * console.log(result.success);
 */
async function myFunction(param1, param2, options = {}) {
  // Implementation
}
```

**For TypeScript:**
```typescript
/**
 * Brief description of what this function does
 *
 * @param param1 - Description of param1
 * @param param2 - Description of param2
 * @param options - Configuration options
 * @returns Description of return value
 * @throws When validation fails
 *
 * @example
 * ```typescript
 * const result = await myFunction('test', 42, { flag: true });
 * console.log(result.success);
 * ```
 */
async function myFunction(
  param1: string,
  param2: number,
  options: { flag?: boolean } = {}
): Promise<{ success: boolean }> {
  // Implementation
}
```

---

## Code Quality Rules

### Complexity Limits
- **Max function complexity:** 10
- **Max nesting depth:** 4
- **Max parameters:** 4
- **Max function lines:** 50
- **Max file lines:** 300

### Best Practices
- ✅ Use `===` instead of `==`
- ✅ Use `const` for constants
- ✅ Prefer arrow functions
- ✅ Use template literals
- ✅ Handle all errors
- ✅ Add JSDoc to public methods
- ❌ No `eval()`
- ❌ No magic numbers
- ❌ No unused variables

### Formatting Standards
- **Quotes:** Single quotes ('string')
- **Semicolons:** Always required
- **Trailing commas:** ES5 style
- **Line length:** 100 characters
- **Indentation:** 2 spaces
- **Arrow parens:** Always

---

## IDE Integration

### VS Code Settings
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ]
}
```

### VS Code Extensions
- ESLint
- Prettier - Code formatter
- EditorConfig for VS Code

---

## Troubleshooting

### "ESLint configuration error"
```bash
# Reinstall dependencies
npm install
```

### "Prettier conflicts with ESLint"
```bash
# Already configured - eslint-config-prettier is installed
# Just run quality:fix
npm run quality:fix
```

### "Too many linting errors"
```bash
# Fix what can be auto-fixed first
npm run quality:fix

# Then review remaining issues
npm run quality
```

### "Can't find constants module"
```javascript
// Use correct path
const constants = require('../config/constants');
// or
const { GEO, TIME } = require('../config/constants');
```

---

## Quick Metrics

**Current Code Quality:**
- **Overall Grade:** B+ (85/100)
- **Formatting:** A+ (95/100) ✅
- **Configuration:** A (90/100) ✅
- **Complexity:** B- (75/100) ⚠️
- **Documentation:** C+ (70/100) ⚠️

**Files:**
- Backend: 86 files, 46,514 lines
- Frontend: 30 files, 8,751 lines

**Issues:**
- Auto-fixed: 2,250 formatting issues ✅
- Remaining: 3,290 (261 errors, 3,029 warnings) ⚠️

---

## Related Documentation

- `/CODE_QUALITY_REPORT.md` - Comprehensive quality report
- `/SPRINT_3_COMPLETION_SUMMARY.md` - Sprint completion summary
- `/backend/src/config/constants.js` - All constants
- `/backend/.eslintrc.js` - Backend linting rules
- `/frontend/.eslintrc.js` - Frontend linting rules

---

**Last Updated:** November 5, 2025
**Version:** 1.0
**Maintained By:** Development Team
