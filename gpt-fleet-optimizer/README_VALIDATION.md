# Database Validation Script

## Overview

The `validate-data.py` script performs comprehensive validation of the BarqFleet production database, checking data quality, record counts, and data integrity across all core tables.

## Quick Start

```bash
# Run the validation script
python3 validate-data.py
```

The script will:
1. Connect to the BarqFleet production read replica
2. Validate all four core tables (orders, shipments, couriers, hubs)
3. Generate a detailed console report
4. Save a JSON report with complete results

## Output Files

- **Console Output**: Real-time validation results with color-coded status indicators
- **JSON Report**: `validation_report_YYYYMMDD_HHMMSS.json` - Detailed validation data
- **Summary Report**: `VALIDATION_SUMMARY.md` - Human-readable analysis

## What Gets Validated

### Orders Table
- Total record count (expected: 2.8M+)
- Records with hub_id
- Records with shipment_id
- Recent activity (last 30 days)
- Records with delivery times
- Order status distribution
- Sample records verification

### Shipments Table
- Total record count (expected: 1.1M+)
- Records with courier_id
- Records with promise_time
- Completed shipments
- Records with driving_distance
- Promise time format verification
- Sample records verification

### Couriers Table
- Total record count (expected: 6,503+)
- Records with vehicle_type
- Online courier count
- Vehicle type distribution
- Sample records verification

### Hubs Table
- Total record count (expected: 22,816+)
- Records with complete data (code, latitude, longitude)
- Geographic coordinate validation
- Sample records verification

## Data Quality Scoring

Each table receives a data quality score (0-100%) based on:
- Meeting minimum record count requirements
- Data completeness percentages
- Field population rates
- Sample data validity

**Overall Score**: Average of all table scores

## Understanding the Output

### Status Indicators
- ✓ PASS - All checks passed, quality score ≥ 70%
- ⚠ WARNING - Some issues detected, review warnings
- ✗ ERROR - Critical failure, check error messages

### Sample Output

```
================================================================================
VALIDATING ORDERS TABLE
================================================================================
Total orders: 2,855,952
  ✓ Meets minimum expected count
Orders with hub_id: 2,855,927 (100.00%)
Orders with shipment_id: 2,719,962 (95.24%)
...
Data Quality Score: 100.0%
```

### JSON Report Structure

```json
{
  "timestamp": "2025-11-20T06:55:23.663525",
  "database": "barqfleet_db",
  "host": "...",
  "tables": {
    "orders": {
      "total_count": 2855952,
      "data_quality_score": 100.0,
      ...
    }
  },
  "warnings": [],
  "errors": []
}
```

## Database Configuration

The script connects to:
- **Host**: barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com
- **Database**: barqfleet_db
- **User**: ventgres
- **Port**: 5432

Connection details are hardcoded in the script for convenience. To use a different database, modify the `DB_CONFIG` dictionary in `validate-data.py`.

## Requirements

```bash
# Install required Python package
pip install psycopg2-binary
```

## Troubleshooting

### Connection Errors
If you see connection errors:
1. Verify network connectivity to AWS RDS
2. Check security group rules allow your IP
3. Confirm database credentials are correct
4. Ensure the read replica is available

### Query Errors
If queries fail:
1. Check the JSON report for specific error messages
2. Review the console output for SQL errors
3. Verify table schemas match expectations
4. Check for database permission issues

### Low Data Quality Scores
If scores are unexpectedly low:
1. Review the warnings section
2. Check sample records for data issues
3. Verify expected minimum counts are accurate
4. Compare with previous validation reports

## Customization

### Adjusting Expected Counts

Edit the `expected_min_count` values in each validation method:

```python
table_results = {
    'total_count': 0,
    'expected_min_count': 2_800_000,  # Adjust this value
    ...
}
```

### Adding New Checks

Add custom validation queries in the respective validation methods:

```python
def validate_orders_table(self):
    # ... existing checks ...

    # Add custom check
    result = self.execute_query(
        "SELECT COUNT(*) as count FROM orders WHERE custom_field IS NOT NULL",
        "Orders with custom field"
    )
    if result:
        count = result[0]['count']
        print(f"Orders with custom field: {count:,}")
```

### Modifying Quality Scoring

Adjust the quality checks in each validation method:

```python
quality_checks = [
    table_results['total_count'] >= table_results['expected_min_count'],
    # Add or modify checks here
    your_custom_check_result,
]
table_results['data_quality_score'] = sum(quality_checks) / len(quality_checks) * 100
```

## Best Practices

1. **Run Regularly**: Schedule weekly validations to track data quality trends
2. **Archive Reports**: Keep historical JSON reports for comparison
3. **Monitor Warnings**: Review and address warnings promptly
4. **Track Metrics**: Monitor data quality scores over time
5. **Document Changes**: Note any validation script customizations

## Exit Codes

- `0`: Validation completed successfully
- `1`: Validation failed with errors

Use exit codes in automation scripts:

```bash
python3 validate-data.py
if [ $? -eq 0 ]; then
    echo "Validation passed"
else
    echo "Validation failed"
    exit 1
fi
```

## Example Usage in CI/CD

```yaml
# .github/workflows/data-validation.yml
name: Database Validation

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: pip install psycopg2-binary
      - name: Run validation
        run: python3 validate-data.py
      - name: Upload report
        uses: actions/upload-artifact@v2
        with:
          name: validation-report
          path: validation_report_*.json
```

## Related Files

- `validate-data.py` - Main validation script
- `VALIDATION_SUMMARY.md` - Latest validation summary report
- `validation_report_*.json` - Detailed validation results

## Support

For issues or questions:
1. Check the VALIDATION_SUMMARY.md for known issues
2. Review the JSON report for detailed error information
3. Examine console output for specific error messages
4. Verify database connectivity and permissions

---

*Last Updated: 2025-11-20*
*Script Version: 1.0*
