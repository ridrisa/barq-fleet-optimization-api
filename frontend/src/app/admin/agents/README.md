# Agent Monitoring Dashboard

## Overview
A comprehensive real-time monitoring dashboard for all AI agents in the Route Optimization System. Provides visibility into agent health, performance, and activity.

## Features

### 1. Real-Time Monitoring
- Auto-refresh every 5 seconds (toggleable)
- Live status updates for all 20+ agents
- Instant error detection and alerting

### 2. System Health Overview
- Overall system health score (0-100%)
- Active/Error/Idle agent counts
- System uptime percentage
- Visual health gauges

### 3. Agent Cards
Each agent card displays:
- **Status**: ACTIVE, ERROR, IDLE, or DISABLED
- **Health Score**: Visual gauge (0-100%)
- **Last Run**: Timestamp of last execution
- **Duration**: How long the last execution took
- **Success Rate**: Percentage of successful executions
- **Total Executions**: Lifetime execution count
- **Errors**: Expandable list of recent errors with severity levels

### 4. Advanced Filtering
- **Search**: Filter by name, description, or category
- **Status Filters**: Quick filter by ACTIVE, ERROR, or IDLE
- **Sorting**: Sort by name, status, health score, or last run time
- **Sort Order**: Ascending or descending

### 5. Activity Log
- Last 50 agent executions
- Status indicators (SUCCESS, FAILURE, TIMEOUT, CANCELLED)
- Duration metrics
- Error messages for failed executions
- Timestamps with relative time

## Components

### Core Components

#### `/app/admin/agents/page.tsx`
Main dashboard page with:
- State management for agents, activities, and system health
- Auto-refresh functionality
- Filtering and sorting logic
- Mock data fallback for development

#### `/components/admin/AgentCard.tsx`
Individual agent card component featuring:
- Expandable error section
- Performance metrics grid
- Health visualization
- Status badge integration

#### `/components/admin/StatusBadge.tsx`
Status indicator component with:
- Color-coded badges (Green/Red/Gray)
- Icon support
- Three size variants (sm/md/lg)

#### `/components/admin/HealthScoreGauge.tsx`
Circular health score gauge with:
- SVG-based circular progress
- Color gradients based on health
- Health labels (Excellent/Good/Fair/Poor)
- Optional trend indicators

#### `/components/admin/AgentActivityLog.tsx`
Activity timeline component with:
- Tabular layout
- Status icons
- Duration formatting
- Error message display

### UI Components

#### `/components/ui/card.tsx`
Card container components:
- Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter

#### `/components/ui/badge.tsx`
Badge component with variants:
- default, secondary, destructive, outline, success, warning, error, info

#### `/components/ui/table.tsx`
Table components:
- Table, TableHeader, TableBody, TableRow, TableHead, TableCell

#### `/components/ui/input.tsx`
Input component for search and forms

### Type Definitions

#### `/types/agent.ts`
TypeScript interfaces for:
- `Agent`: Complete agent data structure
- `AgentStatus`: Status enum
- `AgentError`: Error details
- `AgentActivity`: Activity log entry
- `SystemHealth`: Overall system metrics
- `AgentStatusResponse`: API response structure
- `DashboardFilters`: Filter state

## API Integration

### Endpoint
```typescript
GET /api/admin/agents/status
```

### Response Format
```json
{
  "agents": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "status": "ACTIVE" | "ERROR" | "IDLE" | "DISABLED",
      "lastRun": "ISO8601 timestamp",
      "lastDuration": 250,
      "healthScore": 0.95,
      "successRate": 0.98,
      "totalExecutions": 1543,
      "failedExecutions": 31,
      "averageDuration": 245,
      "errors": [
        {
          "timestamp": "ISO8601 timestamp",
          "message": "Error description",
          "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
        }
      ],
      "enabled": true,
      "category": "string"
    }
  ],
  "systemHealth": {
    "overall": 0.92,
    "totalAgents": 20,
    "activeAgents": 18,
    "errorAgents": 2,
    "idleAgents": 0,
    "disabledAgents": 0,
    "uptimePercentage": 99.2,
    "lastUpdated": "ISO8601 timestamp"
  },
  "recentActivity": [
    {
      "id": "string",
      "agentId": "string",
      "agentName": "string",
      "timestamp": "ISO8601 timestamp",
      "duration": 1200,
      "status": "SUCCESS" | "FAILURE" | "TIMEOUT" | "CANCELLED",
      "errorMessage": "Optional error message"
    }
  ]
}
```

## Usage

### Accessing the Dashboard
```
Navigate to: /admin/agents
```

### Features Usage

#### Toggle Auto-Refresh
Click the "Auto-Refresh" button in the top-right to enable/disable automatic updates.

#### Manual Refresh
Click the "Refresh" button to manually fetch latest data.

#### Search Agents
Type in the search box to filter by name, description, or category.

#### Filter by Status
Click the status filter buttons (Active, Errors, Idle) to show only agents with that status.

#### Sort Agents
Use the sort dropdown to change sorting criteria and toggle ascending/descending order.

#### View Agent Details
Click on any agent card to view detailed information (coming soon: modal with full details).

#### Expand Error Details
Click the error count in an agent card to expand and see recent error messages.

## Color Scheme

### Status Colors
- **ACTIVE**: Green (#10B981)
- **ERROR**: Red (#EF4444)
- **IDLE**: Gray (#6B7280)
- **DISABLED**: Dark Gray (#4B5563)

### Health Score Colors
- **90-100%**: Green (Excellent)
- **70-89%**: Yellow (Good)
- **50-69%**: Orange (Fair)
- **0-49%**: Red (Poor)

### Error Severity Colors
- **CRITICAL**: Red (#EF4444)
- **HIGH**: Orange (#F97316)
- **MEDIUM**: Yellow (#EAB308)
- **LOW**: Blue (#3B82F6)

## Development

### Mock Data
The dashboard includes comprehensive mock data that activates when the API is unavailable. This allows for:
- Frontend development without backend
- UI testing and refinement
- Demo presentations

### Adding New Agent Categories
Update the agent data structure to include new categories. The dashboard automatically handles any category string.

### Customizing Refresh Interval
Modify the interval in the `useEffect` hook:
```typescript
const interval = setInterval(() => {
  fetchAgentStatus();
}, 5000); // Change this value (in milliseconds)
```

### Extending Agent Metrics
Add new metrics to the `Agent` type in `/types/agent.ts` and update the `AgentCard` component to display them.

## Responsive Design

The dashboard is fully responsive:
- **Desktop**: 3-column grid for agent cards
- **Tablet**: 2-column grid
- **Mobile**: Single column, stacked layout

## Dark Mode Support

All components support dark mode via Tailwind CSS dark mode classes.

## Performance Considerations

### Optimizations Implemented
- **React Memoization**: Components use React.memo where appropriate
- **Efficient Filtering**: Client-side filtering with optimized algorithms
- **Lazy Loading**: Activity log limits to 50 most recent items
- **Debounced Search**: Search input updates state immediately but could be debounced for very large datasets

### Future Optimizations
- Virtual scrolling for agent lists with 100+ agents
- WebSocket integration for truly real-time updates
- Pagination for activity log
- Progressive image loading for future enhancements

## Accessibility

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Tab order is logical and intuitive

### Screen Readers
- Proper ARIA labels on all controls
- Status announcements for dynamic content updates

### Color Contrast
- All text meets WCAG 2.1 AA standards
- Color is not the only indicator of status (icons included)

## Testing

### Manual Testing Checklist
- [ ] Dashboard loads successfully
- [ ] Auto-refresh toggles correctly
- [ ] Manual refresh updates data
- [ ] Search filters agents correctly
- [ ] Status filters work independently
- [ ] Sorting changes agent order
- [ ] Agent cards display all metrics
- [ ] Error sections expand/collapse
- [ ] Activity log shows recent activities
- [ ] Dark mode works correctly
- [ ] Responsive on mobile devices

### Future Testing
- Unit tests for components
- Integration tests for API calls
- E2E tests for user workflows

## Troubleshooting

### Dashboard Shows "Using Mock Data"
- **Cause**: Backend API is unavailable or not running
- **Solution**: Start the backend server or check API endpoint configuration

### Agents Not Updating
- **Cause**: Auto-refresh is disabled or API is failing silently
- **Solution**: Enable auto-refresh or check browser console for errors

### Search Not Working
- **Cause**: JavaScript error or typing in wrong field
- **Solution**: Clear search field and try again, check console for errors

### Cards Not Displaying Correctly
- **Cause**: Missing Tailwind CSS or component import errors
- **Solution**: Verify all components are imported correctly and Tailwind is configured

## Future Enhancements

### Planned Features
- [ ] Agent detail modal with full history
- [ ] Real-time WebSocket integration
- [ ] Agent control actions (start/stop/restart)
- [ ] Custom alert thresholds
- [ ] Export activity logs (CSV/JSON)
- [ ] Agent performance graphs
- [ ] Historical trend analysis
- [ ] Agent dependency visualization
- [ ] Scheduled agent execution
- [ ] Agent configuration editor

### Potential Integrations
- Slack/Teams notifications for agent failures
- Prometheus metrics export
- Grafana dashboard integration
- PagerDuty incident creation
- Email alerts for critical errors

## Contributing

When adding new features:
1. Update TypeScript types first
2. Create/update components with proper types
3. Update this README
4. Add mock data for testing
5. Test in both light and dark modes
6. Verify responsive design
7. Check accessibility

## License

Part of the AI Route Optimization System.
