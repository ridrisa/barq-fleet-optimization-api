# The Fleet Optimizer GPT

**AI-Powered Analytics for On-Demand Last-Mile Logistics**

A custom GPT assistant that analyzes historical data from the BARQ Fleet Management system to provide actionable insights for route optimization, fleet performance, and delivery efficiency.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Module Reference](#module-reference)
- [Creating the Custom GPT](#creating-the-custom-gpt)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Fleet Optimizer GPT is a specialized AI assistant designed to analyze historical logistics data and provide natural language insights for fleet management operations. Built on historical data from the barqfleet_db PostgreSQL database, it enables operations managers, dispatchers, and analysts to:

- Analyze route efficiency and identify optimization opportunities
- Compare driver and vehicle performance with statistical rigor
- Forecast delivery demand and plan resource requirements
- Get real-time route optimization via API integration

### Architecture

```
┌─────────────────────────────────────────────────┐
│                 Custom GPT                       │
│         (ChatGPT with Instructions)             │
└────────────────┬────────────────────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
┌─────▼─────┐         ┌─────▼──────┐
│  Python   │         │   BARQ     │
│  Scripts  │         │    API     │
└─────┬─────┘         └─────┬──────┘
      │                     │
      │              https://route-opt-backend
      │                .us-central1.run.app
      │
┌─────▼──────────────────────┐
│    barqfleet_db            │
│  (PostgreSQL + PostGIS)    │
└────────────────────────────┘
```

---

## Features

### 1. Route Efficiency Analysis
- Calculate route efficiency scores (0-100)
- Identify bottlenecks and underperforming routes
- Perform ABC/Pareto analysis to prioritize high-volume routes
- Compare actual vs. optimal routing

### 2. Fleet Performance Analytics
- Driver Performance Index (DPI) with comprehensive metrics
- Vehicle Performance Index (VPI) and utilization tracking
- Statistical comparison of driver cohorts (ANOVA, t-tests)
- Top/bottom performer identification

### 3. Demand Forecasting
- Hourly, daily, and weekly demand patterns
- Resource requirement predictions (drivers, vehicles)
- Peak hour identification
- Growth trend analysis

### 4. API Integration
- Real-time route optimization requests
- Historical optimization retrieval
- Status tracking for async operations
- Direct integration with deployed backend

---

## Installation

### Prerequisites

- Python 3.8+
- PostgreSQL database with historical shipment data
- Access to barqfleet_db (or local replica)
- Internet connection for API calls

### Setup

1. **Clone or download** this directory:
```bash
cd /path/to/gpt-fleet-optimizer
```

2. **Install Python dependencies**:
```bash
pip install -r requirements.txt
```

3. **Set environment variables**:
```bash
# Database configuration
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_NAME="barq_logistics"
export DB_USER="postgres"
export DB_PASSWORD="your_password"

# API configuration (optional)
export BARQ_API_URL="https://route-opt-backend-426674819922.us-central1.run.app"
```

4. **Test database connection**:
```bash
python route_analyzer.py --analysis_type efficiency --date_range 7
```

---

## Configuration

### Database Configuration

The Python scripts connect to PostgreSQL to analyze historical data. Configure via environment variables or modify the scripts directly:

```python
db_config = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'barq_logistics'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}
```

### Expected Database Schema

The scripts expect the following tables:

- **shipments**: Core delivery data with pickup/delivery locations, timestamps, status
- **hubs**: Distribution centers and service areas
- **drivers**: Driver information (referenced by shipments)
- **vehicles**: Vehicle information (referenced by shipments)

Required fields in `shipments` table:
```sql
- id, tracking_number
- hub_id, driver_id, vehicle_id
- pickup_latitude, pickup_longitude
- delivery_latitude, delivery_longitude
- created_at, promised_delivery_at, actual_delivery_at
- status (delivered, completed, failed, etc.)
```

---

## Usage Examples

### 1. Analyze Route Efficiency

**Identify inefficient routes over the last 30 days:**

```bash
python route_analyzer.py \
  --analysis_type efficiency \
  --date_range 30 \
  --output console
```

**Output:**
```
================================================================================
ANALYSIS RESULTS: EFFICIENCY
================================================================================

📊 Overall Metrics:
  total_deliveries: 1543
  avg_efficiency_score: 78.5
  avg_on_time_rate: 84.2
  avg_delivery_hours: 2.3
  total_hubs_analyzed: 8

🏆 Top 5 Performers:
  1. Downtown Hub - Score: 92.3
  2. Airport Hub - Score: 89.1
  3. North Side - Score: 85.7
  4. West End - Score: 82.4
  5. Eastgate - Score: 80.9

⚠️  Bottom 5 Performers:
  1. South Valley - Score: 65.3
  2. Remote Hills - Score: 68.1
  3. Industrial Park - Score: 71.2
```

### 2. Find Operational Bottlenecks

**Identify peak hours and driver overload periods:**

```bash
python route_analyzer.py \
  --analysis_type bottlenecks \
  --date_range 30 \
  --output json
```

### 3. Perform ABC Analysis

**Classify routes by volume (Pareto principle):**

```bash
python route_analyzer.py \
  --analysis_type abc \
  --min_deliveries 10
```

### 4. Analyze Driver Performance

**Compare all drivers over the last month:**

```bash
python fleet_performance.py \
  --metric delivery_rate \
  --period monthly \
  --analysis_type driver
```

**Focus on a specific driver:**

```bash
python fleet_performance.py \
  --metric efficiency \
  --period weekly \
  --analysis_type driver \
  --driver_id 42
```

### 5. Analyze Vehicle Utilization

```bash
python fleet_performance.py \
  --metric efficiency \
  --period monthly \
  --analysis_type vehicle
```

### 6. Compare Driver Cohorts

**Statistical comparison of performance tiers:**

```bash
python fleet_performance.py \
  --analysis_type cohort \
  --period monthly
```

### 7. Forecast Delivery Demand

**Hourly forecast for next week:**

```bash
python demand_forecaster.py \
  --forecast_type hourly \
  --horizon 7
```

**Daily forecast for next month:**

```bash
python demand_forecaster.py \
  --forecast_type daily \
  --horizon 30
```

**Resource requirements planning:**

```bash
python demand_forecaster.py \
  --forecast_type resource \
  --horizon 14
```

### 8. API Integration

**Check API health:**

```bash
python api_connector.py --action health_check
```

**Get optimization history:**

```bash
python api_connector.py \
  --action get_history \
  --limit 20
```

**Submit optimization request:**

```bash
python api_connector.py \
  --action optimize_route \
  --input_file sample_request.json \
  --output_file optimization_result.json
```

**Check request status:**

```bash
python api_connector.py \
  --action get_status \
  --request_id abc123-def456
```

---

## Module Reference

### route_analyzer.py

Analyzes historical route performance and identifies optimization opportunities.

**Analysis Types:**
- `efficiency`: Calculate route efficiency scores, identify top/bottom performers
- `bottlenecks`: Find peak hours, driver overload periods, capacity constraints
- `abc`: Perform Pareto analysis to classify routes by volume

**Key Metrics:**
- Route Efficiency Score (0-100)
- On-time delivery rate
- Average delivery time
- Distance optimization ratio

**Usage:**
```bash
python route_analyzer.py --analysis_type TYPE --date_range DAYS [--hub_id ID]
```

---

### fleet_performance.py

Analyzes driver and vehicle performance with statistical comparisons.

**Analysis Types:**
- `driver`: Comprehensive driver performance analysis
- `vehicle`: Vehicle utilization and efficiency analysis
- `cohort`: Statistical comparison of driver performance tiers

**Key Metrics:**
- Driver Performance Index (DPI): 0-100 composite score
  - Success rate (40%), On-time rate (30%), Productivity (20%), Speed (10%)
- Vehicle Performance Index (VPI): 0-100 composite score
  - Success rate (50%), Utilization (30%), Efficiency (20%)

**Usage:**
```bash
python fleet_performance.py --analysis_type TYPE --period PERIOD [--driver_id ID] [--vehicle_id ID]
```

---

### demand_forecaster.py

Predicts delivery demand patterns and resource requirements.

**Forecast Types:**
- `hourly`: Hour-by-hour demand for next N days
- `daily`: Daily demand with trend analysis
- `resource`: Driver and vehicle requirements planning

**Forecasting Methods:**
- Historical pattern matching
- Day-of-week seasonality
- Linear trend projection
- Statistical confidence intervals

**Usage:**
```bash
python demand_forecaster.py --forecast_type TYPE --horizon DAYS [--hub_id ID]
```

---

### api_connector.py

Integrates with BARQ Route Optimization API for real-time operations.

**Actions:**
- `health_check`: Verify API availability
- `get_history`: Retrieve past optimization results
- `optimize_route`: Submit new optimization request
- `get_status`: Check request processing status
- `get_result`: Fetch complete optimization result

**Usage:**
```bash
python api_connector.py --action ACTION [--input_file FILE] [--request_id ID]
```

---

## Creating the Custom GPT

### Step 1: Create a new GPT

1. Go to https://chat.openai.com/
2. Click your profile → "My GPTs" → "Create a GPT"
3. Name it "The Fleet Optimizer"

### Step 2: Configure Instructions

Copy the entire contents of `GPT_INSTRUCTIONS.md` into the GPT instructions field.

### Step 3: Enable Code Interpreter

1. In GPT settings, enable "Code Interpreter"
2. Upload all Python scripts:
   - `route_analyzer.py`
   - `fleet_performance.py`
   - `demand_forecaster.py`
   - `api_connector.py`

### Step 4: Upload Knowledge Base

Optionally upload:
- Sample database export (anonymized)
- This README.md
- Performance benchmarks

### Step 5: Test the GPT

Try these queries:
- "Analyze route efficiency for last month"
- "Who are my top 10 drivers this week?"
- "What are peak delivery hours on Friday?"
- "Forecast demand for next 7 days"
- "How many drivers do I need for Monday afternoon rush?"

---

## Deployment

### Option 1: Local Development

Run scripts directly with Python on your local machine or server with database access.

### Option 2: Cloud Functions

Deploy individual scripts as Google Cloud Functions or AWS Lambda for on-demand execution.

Example for Google Cloud Functions:
```bash
gcloud functions deploy route-analyzer \
  --runtime python39 \
  --trigger-http \
  --entry-point analyze_efficiency \
  --set-env-vars DB_HOST=... \
  --allow-unauthenticated
```

### Option 3: Custom GPT (ChatGPT)

For non-technical users, the Custom GPT provides a conversational interface:

1. User asks natural language question
2. GPT interprets the question
3. GPT executes appropriate Python script
4. GPT presents results in plain language with recommendations

---

## Troubleshooting

### Database Connection Issues

**Problem:** `psycopg2.OperationalError: could not connect to server`

**Solutions:**
- Verify database credentials in environment variables
- Check PostgreSQL is running: `psql -h localhost -U postgres -l`
- Ensure firewall allows PostgreSQL port (5432)
- For remote databases, verify network connectivity

### Missing PostGIS Extension

**Problem:** `ERROR: function st_distance does not exist`

**Solution:**
```sql
-- Connect to your database
psql -d barq_logistics

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
```

### No Data Returned

**Problem:** Analysis returns "No data available"

**Solutions:**
- Verify shipments table has data: `SELECT COUNT(*) FROM shipments;`
- Check date range: recent data may not exist
- Reduce `min_deliveries` threshold for ABC analysis
- Verify status values match expectations (`delivered`, `completed`)

### API Connection Errors

**Problem:** `requests.exceptions.ConnectionError`

**Solutions:**
- Check API URL is correct
- Verify internet connectivity
- Test with health check: `python api_connector.py --action health_check`
- Check API is deployed and running on Cloud Run

### Dependency Issues

**Problem:** `ModuleNotFoundError: No module named 'pandas'`

**Solution:**
```bash
pip install -r requirements.txt
```

Or install individually:
```bash
pip install psycopg2-binary pandas numpy scipy requests
```

---

## Performance Tips

### For Large Datasets

1. **Use date ranges** to limit query scope:
   ```bash
   --date_range 30  # Last 30 days instead of all history
   ```

2. **Filter by hub** for faster queries:
   ```bash
   --hub_id 5  # Analyze single hub
   ```

3. **Add database indexes**:
   ```sql
   CREATE INDEX idx_shipments_created_at ON shipments(created_at);
   CREATE INDEX idx_shipments_driver_id ON shipments(driver_id);
   CREATE INDEX idx_shipments_hub_id ON shipments(hub_id);
   CREATE INDEX idx_shipments_status ON shipments(status);
   ```

4. **Use JSON output** for machine processing:
   ```bash
   --output json > result.json
   ```

---

## Key Metrics Explained

### Route Efficiency Score (0-100)
Composite metric calculated as:
```
Score = (Actual Distance / Optimal Distance) × (Optimal Time / Actual Time) × 100
```
- **90-100**: Excellent - Routes are highly optimized
- **80-89**: Good - Minor improvements possible
- **70-79**: Fair - Noticeable inefficiencies
- **<70**: Poor - Requires immediate attention

### Driver Performance Index (DPI)
Weighted composite:
- 40%: Success Rate (first-attempt deliveries)
- 30%: On-time Rate (within promised window)
- 20%: Productivity (deliveries per day, normalized)
- 10%: Speed (delivery time efficiency)

### Vehicle Performance Index (VPI)
Weighted composite:
- 50%: Success Rate
- 30%: Utilization (trips per day)
- 20%: Efficiency (deliveries per km)

---

## Contributing

This is an internal tool for BARQ Fleet Management. For questions or improvements, contact the analytics team.

---

## Version History

- **v1.0** (November 2025): Initial release
  - Route efficiency analysis
  - Fleet performance analytics
  - Demand forecasting
  - API integration

---

## License

Internal use only - BARQ Fleet Management

---

## Support

For technical support, data issues, or feature requests:
- Email: analytics@barq.com
- Slack: #fleet-analytics
- Wiki: https://wiki.barq.com/fleet-optimizer

---

**Built with**: Python, PostgreSQL, PostGIS, OpenAI GPT-4
**Deployed**: Google Cloud Run
**Data Source**: barqfleet_db (Production Read Replica)
