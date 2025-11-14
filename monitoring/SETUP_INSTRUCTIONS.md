# Monitoring Setup Instructions

## Quick Start - Use Built-in Cloud Run Metrics

The easiest way to monitor your service is to use the built-in Cloud Run metrics dashboard:

**URL:** https://console.cloud.google.com/run/detail/us-central1/route-opt-backend/metrics?project=looker-barqdata-2030

This provides:
- ✅ Request count
- ✅ Request latency (P50, P95, P99)
- ✅ Container CPU utilization
- ✅ Container memory utilization
- ✅ Container instance count
- ✅ Billable container time

**No setup required!**

---

## Create Custom Dashboard (Optional)

If you want a custom dashboard with multiple services, create it manually in Cloud Console:

### Steps:

1. **Go to Monitoring Dashboards:**
   https://console.cloud.google.com/monitoring/dashboards?project=looker-barqdata-2030

2. **Click "+ CREATE DASHBOARD"**

3. **Name it:** "BARQ Fleet Manager - Production"

4. **Add Widgets:**

   For each metric, click "+ ADD WIDGET" → Select "Line Chart":

   **Widget 1: Request Count**
   - Resource type: Cloud Run Revision
   - Metric: Request count
   - Filter: `resource.labels.service_name="route-opt-backend"`
   - Aligner: rate
   - Title: "API Request Rate"

   **Widget 2: Response Latency**
   - Metric: Request latencies
   - Reducer: 95th percentile
   - Title: "Response Latency (P95)"

   **Widget 3: Error Rate**
   - Metric: Request count
   - Filter: Add `metric.labels.response_code_class="5xx"`
   - Title: "Error Rate (5xx)"

   **Widget 4: CPU Utilization**
   - Metric: Container CPU utilization
   - Title: "CPU Usage"

   **Widget 5: Memory Utilization**
   - Metric: Container memory utilization
   - Title: "Memory Usage"

   **Widget 6: Active Instances**
   - Metric: Container instance count
   - Title: "Active Instances"

5. **Save Dashboard**

---

## Set Up Alerts

### Recommended Alerts:

1. **High Error Rate**
   - Go to: https://console.cloud.google.com/monitoring/alerting/policies/create?project=looker-barqdata-2030
   - Condition: Request count (5xx) > 1% of total requests
   - Duration: 5 minutes
   - Notification: Your email

2. **High Latency**
   - Condition: Request latencies (P95) > 1000ms
   - Duration: 5 minutes

3. **High CPU**
   - Condition: CPU utilization > 80%
   - Duration: 10 minutes

4. **Service Down**
   - Condition: Request count = 0
   - Duration: 5 minutes
   - **Priority: P1** (Critical)

### Setup Steps:

1. Click "CREATE POLICY"
2. Select "Cloud Run Revision" as resource
3. Choose your metric
4. Set threshold
5. Configure notification channel
6. Save

---

## View Logs

**Cloud Run Logs:**
https://console.cloud.google.com/run/detail/us-central1/route-opt-backend/logs?project=looker-barqdata-2030

**Filter by operation:**
```
jsonPayload.operation="assignOrdersDynamic"
```

**Filter by errors:**
```
severity="ERROR"
```

**Filter by specific driver:**
```
jsonPayload.driver_id="DRV_001"
```

---

## Current Status

✅ **Rate Limiting:** Active on all 13 endpoints
✅ **Enhanced Logging:** Structured logs with operation IDs
✅ **Built-in Metrics:** Available in Cloud Run console
✅ **Alert Configurations:** Ready in `alert-policies.yaml`

**Next Steps:**
1. Use built-in Cloud Run metrics (recommended)
2. Create custom dashboard if needed (optional)
3. Set up 2-3 critical alerts (recommended)
4. Configure notification channels

---

## Links

- **Service Metrics:** https://console.cloud.google.com/run/detail/us-central1/route-opt-backend/metrics?project=looker-barqdata-2030
- **Service Logs:** https://console.cloud.google.com/run/detail/us-central1/route-opt-backend/logs?project=looker-barqdata-2030
- **Create Dashboard:** https://console.cloud.google.com/monitoring/dashboards?project=looker-barqdata-2030
- **Create Alerts:** https://console.cloud.google.com/monitoring/alerting?project=looker-barqdata-2030
- **Metrics Explorer:** https://console.cloud.google.com/monitoring/metrics-explorer?project=looker-barqdata-2030

---

**Note:** The `cloud-monitoring-dashboard.json` file is provided as a reference but may need updates for the current API version. Manual creation through the UI is recommended for best results.
