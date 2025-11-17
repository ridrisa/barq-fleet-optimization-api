# 📁 Project Directory Structure

## Overview
This document describes the organized structure of the AI Route Optimization API project.

---

## 🏗️ Root Directory Structure

```
AI-Route-Optimization-API/
├── backend/                      # Backend Node.js/Express API
├── frontend/                     # Frontend Next.js application
├── docs/                         # Documentation (NEW! ✅)
├── scripts/                      # Utility scripts (NEW! ✅)
├── test-data/                    # Test data files (NEW! ✅)
├── barqfleet_db_files/          # Database utilities
├── gpt-fleet-optimizer/         # Python analytics service
└── node_modules/                # Dependencies
```

---

## 📚 Documentation (`docs/`)

### **Implementation Docs** (`docs/implementation/`)
- `ENGINE_VISIBILITY_IMPLEMENTATION.md` - Complete guide to engine visibility feature
- `PHASE_1_IMPLEMENTATION.md` - Phase 1 implementation details
- `COMPLETE_FIX_SUMMARY.md` - Summary of all fixes

### **Testing Docs** (`docs/testing/`)
- `QA-TEST-REPORT-2025-11-16.md` - QA test results and reports

### **Planning Docs** (`docs/planning/`)
- `REFACTORING_CHECKLIST.md` - Refactoring tasks checklist
- `REFACTORING_PLAN.md` - Detailed refactoring plan
- `REFACTORING_ROADMAP.md` - Long-term refactoring roadmap
- `REFACTORING_SUMMARY.md` - Refactoring summary
- `OPTIMIZATION_VISUAL_GUIDE.md` - Visual guide to optimization
- `PERFORMANCE_ANALYSIS_REPORT.md` - Performance analysis
- `PERFORMANCE_SUMMARY.md` - Performance summary
- `QUICK_OPTIMIZATION_GUIDE.md` - Quick start optimization guide

### **Root Docs** (`docs/`)
- `DEMO-SUMMARY.md` - Demo scenario summary

---

## 🔧 Scripts (`scripts/`)

### **Testing Scripts** (`scripts/testing/`)
All shell scripts for testing and validation:
- `consolidate-env-files.sh` - Environment file management
- `detailed-endpoint-check.sh` - Endpoint validation
- `final-success-calculation.sh` - Success rate calculation
- `fix-integration.sh` - Integration fixes
- `investigate-failing-endpoints.sh` - Debugging helper
- `quick-endpoint-count.sh` - Quick endpoint count
- `quick-production-validation.sh` - Production validation
- `setup-database-connection.sh` - Database setup
- `test-auth-quick-start.sh` - Auth testing
- `test-demo-db-orders.sh` - Demo order testing
- `test-sla-optimization.sh` - SLA testing
- `verify-automation-schema.sh` - Schema verification
- `verify-websocket.sh` - WebSocket testing

### **Utilities** (`scripts/utilities/`)
Python utility scripts:
- `clean-db.py` - Database cleanup utility
- `fix-analytics-transactions.py` - Analytics transaction fixes

---

## 🧪 Test Data (`test-data/`)

Test scenarios and response data:
- `demo-request.json` - Demo request payload
- `demo-response.json` - Demo response data
- `demo-scenario.json` - Demo scenario configuration
- `response.json` - Generic test response
- `llm-response.json` - LLM test response
- `endpoint-test-report.json` - Endpoint test results
- `endpoint-test-results.json` - Detailed test results

---

## 🎨 Frontend (`frontend/`)

### **New Components** (`frontend/src/components/`) ✨
Engine Visibility Feature:
- `optimization-details.tsx` - Displays optimization engine metadata
- `engine-selector.tsx` - Engine selection UI component

### **Updated Components**
- `optimization-form.tsx` - Added engine selector
- `route-list.tsx` - Added engine details display

### **Updated Types** (`frontend/src/store/slices/`)
- `routesSlice.ts` - Added engine metadata types

### **Structure**
```
frontend/
├── src/
│   ├── app/                     # Next.js app directory
│   ├── components/              # React components
│   │   ├── admin/              # Admin components
│   │   ├── ui/                 # UI primitives
│   │   ├── optimization-details.tsx     # NEW! ✅
│   │   ├── engine-selector.tsx          # NEW! ✅
│   │   ├── optimization-form.tsx        # UPDATED ✅
│   │   └── route-list.tsx              # UPDATED ✅
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utilities
│   ├── store/                  # Redux store
│   │   └── slices/
│   │       └── routesSlice.ts          # UPDATED ✅
│   └── types/                  # TypeScript types
├── public/                     # Static assets
└── package.json               # Dependencies
```

---

## ⚙️ Backend (`backend/`)

### **Structure**
```
backend/
├── src/
│   ├── agents/                 # AI agents (17 agents)
│   ├── ai/                     # AI services
│   │   ├── unifiedAdvisor.js
│   │   ├── gptAdvisor.js
│   │   ├── geminiAdvisor.js
│   │   └── claudeAnalyst.js
│   ├── api/                    # API routes
│   ├── config/                 # Configuration
│   ├── controllers/            # API controllers
│   ├── middleware/             # Express middleware
│   ├── routes/                 # Route definitions
│   ├── services/               # Business logic (39 services)
│   │   ├── hybrid-optimization.service.js
│   │   ├── enhanced-cvrp-optimizer.service.js
│   │   ├── osrm.service.js
│   │   ├── dynamic-route-optimizer.service.js
│   │   └── smart-batching.service.js
│   ├── utils/                  # Utilities
│   │   └── algorithms/        # Optimization algorithms
│   │       ├── hungarian.js
│   │       └── twoOpt.js
│   └── validation/            # Request validation
└── optimization-service/      # Python OR-Tools CVRP
    └── app.py
```

---

## 🐍 Python Services

### **GPT Fleet Optimizer** (`gpt-fleet-optimizer/`)
Python analytics microservice:
- `api_server.py` - Flask API server
- `sla_analytics.py` - SLA analysis engine
- `route_analyzer.py` - Route analysis engine
- `fleet_performance.py` - Fleet performance engine
- `demand_forecaster.py` - Demand forecasting engine

### **CVRP Service** (`backend/optimization-service/`)
- `app.py` - OR-Tools CVRP solver

---

## 🗄️ Database Files (`barqfleet_db_files/`)

PostgreSQL utilities and queries:
- `barqfleet_connect.py` - Database connection
- `sla_monitor.py` - SLA monitoring
- `sla_dashboard.py` - SLA dashboard
- `sla_watcher.py` - SLA watcher
- `queries_external_metrics.py` - Metrics queries

---

## 📦 Key Files

### **Configuration**
- `.env` - Environment variables
- `.env.example` - Example environment configuration
- `package.json` - Root dependencies
- `package-lock.json` - Dependency lock

### **API Collection**
- `Route Optimization API.postman_collection.json` - Postman API tests

### **Documentation**
- `README.md` - Main project README
- `DIRECTORY_STRUCTURE.md` - This file!

---

## 🎯 Recent Changes (Engine Visibility Feature)

### **New Files**
1. ✅ `frontend/src/components/optimization-details.tsx` (254 lines)
2. ✅ `frontend/src/components/engine-selector.tsx` (233 lines)
3. ✅ `docs/implementation/ENGINE_VISIBILITY_IMPLEMENTATION.md`

### **Modified Files**
1. ✅ `frontend/src/store/slices/routesSlice.ts` (+49 lines)
2. ✅ `frontend/src/components/route-list.tsx` (+17 lines)
3. ✅ `frontend/src/components/optimization-form.tsx` (+21 lines)

### **Organized**
1. ✅ Created `docs/` hierarchy
2. ✅ Created `scripts/` hierarchy
3. ✅ Created `test-data/` directory
4. ✅ Moved all documentation files
5. ✅ Moved all test scripts
6. ✅ Moved all test data

---

## 📊 Statistics

### **Code**
- **Total Services**: 39 backend services
- **Total Agents**: 17 AI agents
- **Total Engines**: 26 optimization engines
- **New Components**: 2 frontend components
- **Lines Added**: ~574 lines (engine visibility)

### **Documentation**
- **Implementation Docs**: 3 files
- **Planning Docs**: 7 files
- **Testing Docs**: 1 file
- **Total Docs**: 12+ markdown files

### **Scripts**
- **Testing Scripts**: 13 shell scripts
- **Utility Scripts**: 2 Python scripts
- **Total Scripts**: 15+ automation scripts

---

## 🚀 Quick Navigation

### **For Developers**
- Backend code: `backend/src/`
- Frontend code: `frontend/src/`
- New components: `frontend/src/components/optimization-details.tsx` & `engine-selector.tsx`

### **For Documentation**
- Feature docs: `docs/implementation/`
- Planning docs: `docs/planning/`
- Testing docs: `docs/testing/`

### **For Testing**
- Test scripts: `scripts/testing/`
- Test data: `test-data/`
- Utilities: `scripts/utilities/`

### **For Operations**
- Environment: `.env.example`
- API collection: `Route Optimization API.postman_collection.json`
- Database: `barqfleet_db_files/`

---

## 📝 Notes

1. **Clean Structure**: All temporary files organized into appropriate directories
2. **Clear Separation**: Docs, scripts, and test data in separate directories
3. **Easy Navigation**: Logical hierarchy for quick file location
4. **Maintainable**: Clear naming conventions and structure

---

**Last Updated**: November 17, 2025
**Structure Version**: 2.0 (Organized)
**Status**: ✅ Clean and Organized
