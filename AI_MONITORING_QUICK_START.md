# AI Monitoring Dashboard - Quick Start Guide

## 🚀 Access the Dashboard

### URL
```
http://your-domain/admin/agents/ai-monitoring
```

### From Existing Dashboard
1. Navigate to `/admin/agents`
2. Click the purple "AI Monitoring" button in the header

---

## 📊 What You'll See

### 1. Summary Cards (Top Section)
- **Total AI Calls**: How many times AI was used
- **Total Cost**: Accumulated AI expenses
- **Avg Cost per Call**: Cost efficiency metric
- **Total Tokens**: Processing volume
- **Avg Tokens per Call**: Typical request size
- **Date Range**: Current filter range

### 2. AI Provider Usage (Left Card)
- Breakdown by provider (Groq, Gemini, Claude, GPT)
- Per-provider costs and call counts
- Success rates and response times
- Token usage by provider

### 3. Cost Trend Chart (Right Card)
- Daily cost visualization
- Trend analysis (up/down percentage)
- Hover for daily details
- Recent data highlighted in blue

### 4. Recent AI Calls Table (Bottom)
- Last 20 API calls
- Timestamp, provider, model
- Tokens used, cost, response time
- Success/failure status

---

## 🔧 Using Filters

### Date Range
1. Click "Start Date" picker
2. Select start date
3. Click "End Date" picker
4. Select end date
5. Click "Apply Filters"

**Default**: Last 30 days

### Provider Filter
1. Click "Provider" dropdown
2. Select specific provider or "All Providers"
3. Click "Apply Filters"

**Options**:
- All Providers (default)
- Groq
- Gemini
- Claude
- GPT

---

## 💾 Exporting Data

1. Click "Export" button in header
2. CSV file downloads automatically
3. File includes: Date, Provider, Calls, Tokens, Cost

**Filename**: `ai-metrics-YYYY-MM-DD.csv`

---

## 🔄 Refreshing Data

### Manual Refresh
Click "Refresh" button in header

### Auto-Refresh
Not enabled by default (to prevent excessive API calls)

---

## 📈 Key Metrics Explained

### Success Rate
- **95%+**: Excellent (green)
- **85-95%**: Good (yellow)
- **<85%**: Needs attention (red)

### Response Time
- **<500ms**: Fast
- **500-1000ms**: Normal
- **>1000ms**: Slow

### Cost Trends
- **Upward trend**: Increasing usage/costs
- **Downward trend**: Decreasing usage/costs
- Compare recent 7 days vs overall average

---

## 🛠️ Troubleshooting

### "Using Mock Data" Warning
**Cause**: Backend API not available
**Solution**: 
- Check backend is running
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check authentication

### No Data Showing
**Cause**: No AI insights in database
**Solution**:
- Run some optimizations with AI insights enabled
- Check date range filters
- Verify database connection

### Provider Not Showing
**Cause**: Provider hasn't been used in date range
**Solution**:
- Expand date range
- Remove provider filter
- Check if provider is enabled (API keys set)

---

## 🎯 Best Practices

### Cost Monitoring
1. Check dashboard weekly
2. Look for unexpected spikes
3. Compare provider costs
4. Adjust provider usage based on cost/performance

### Performance Tracking
1. Monitor success rates
2. Track response times
3. Identify slow providers
4. Switch providers if needed

### Budget Management
1. Set monthly budget
2. Track projected costs
3. Alert team if over budget
4. Optimize provider selection

---

## 📱 Mobile Access

Dashboard is fully responsive:
- Cards stack vertically on mobile
- Tables scroll horizontally
- Touch-friendly buttons
- Readable text sizes

---

## 🔐 Access Control

### Required Permissions
- Authentication required
- Admin or Manager role

### API Endpoints Used
- `GET /api/v1/admin/ai/metrics`
- `GET /api/v1/admin/ai/providers`
- `GET /api/v1/admin/ai/cost-analysis`

---

## 📞 Support

### Issues?
1. Check browser console for errors
2. Verify backend is running
3. Check authentication status
4. Review API logs

### Feature Requests?
Submit through your team's process

---

## 🎓 Understanding the Data

### Where Does It Come From?
- AI insights are stored during optimization
- Extracted from `route_optimizations` table
- Aggregated by backend API
- Displayed in real-time dashboard

### What's Tracked?
- Every AI API call
- Model used
- Tokens consumed
- Cost incurred
- Response time
- Success/failure

### Why It Matters?
- **Cost Control**: Monitor AI spending
- **Performance**: Identify slow providers
- **Reliability**: Track success rates
- **Optimization**: Choose best provider for use case

---

**Last Updated**: January 17, 2025
**Version**: 1.0.0
