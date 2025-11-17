# CVRP Advanced Settings UI - User Guide

## Visual Overview

### Location in Form
The CVRP Advanced Settings section appears in the optimization form between the "Preferences" section and "Additional Notes" section.

```
┌──────────────────────────────────────────────────────┐
│  New Optimization Request                         [X] │
├──────────────────────────────────────────────────────┤
│                                                       │
│  [Pickup Points] [Delivery Points] [Fleet]           │
│                                                       │
│  ━━━ Business Rules ━━━                              │
│  [...business rules controls...]                     │
│                                                       │
│  ━━━ Preferences ━━━                                 │
│  [...preferences controls...]                        │
│                                                       │
│  ━━━ CVRP Advanced Settings ━━━  ← NEW SECTION      │
│  ⚙️ CVRP Advanced Settings                           │
│  ⓘ Capacitated Vehicle Routing Problem constraints   │
│                                                       │
│  ▼ Time Windows                        [Enabled]     │
│  ▼ Vehicle Capacities                                │
│  ▼ Service Times                                     │
│  ▼ Driver Break Times                                │
│  ▼ Max Distance & Duration                           │
│                                                       │
│  ━━━ Additional Notes ━━━                            │
│  [...notes textarea...]                              │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## Section 1: Time Windows

### Collapsed State
```
┌──────────────────────────────────────────────────────┐
│  🕐 Time Windows                    [Enabled]      ▼ │
└──────────────────────────────────────────────────────┘
```

### Expanded State (When Enabled)
```
┌──────────────────────────────────────────────────────┐
│  🕐 Time Windows                    [Enabled]      ▲ │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ⚙️ Enable Time Window Constraints      [ON]         │
│                                                       │
│  ╭───────────────────────────────────────────────╮  │
│  │ Time windows are configured per pickup/      │  │
│  │ delivery point. Each point can have a start  │  │
│  │ and end time constraint.                      │  │
│  │                                                │  │
│  │ ⓘ Example: Pickup points accept deliveries   │  │
│  │   between 08:00-18:00, delivery points have   │  │
│  │   specific time windows like 09:00-12:00.     │  │
│  ╰───────────────────────────────────────────────╯  │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**Features**:
- Toggle switch to enable/disable time windows
- Information panel with examples
- Time windows are set per pickup/delivery point in the main form

---

## Section 2: Vehicle Capacities

### Collapsed State
```
┌──────────────────────────────────────────────────────┐
│  ⚖️ Vehicle Capacities                              ▼ │
└──────────────────────────────────────────────────────┘
```

### Expanded State (When Enabled)
```
┌──────────────────────────────────────────────────────┐
│  ⚖️ Vehicle Capacities                [Enabled]    ▲ │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ⚙️ Enable Capacity Constraints         [ON]         │
│                                                       │
│  ╭───────────────────────────────────────────────╮  │
│  │ Capacity Unit                                  │  │
│  │  [Kg] [Liters] [Units]                         │  │
│  ╰───────────────────────────────────────────────╯  │
│                                                       │
│  Vehicle Capacities                                   │
│  ╭───────────────────────────────────────────────╮  │
│  │ Riyadh Truck 1           [3000      ] kg       │  │
│  │ Riyadh Truck 2           [3000      ] kg       │  │
│  │ Riyadh Truck 3           [3000      ] kg       │  │
│  ╰───────────────────────────────────────────────╯  │
│  (scrollable if many vehicles)                        │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**Features**:
- Toggle switch to enable/disable capacity constraints
- Capacity unit selector (kg, liters, units)
- Per-vehicle capacity editor with inline input fields
- Scrollable list for many vehicles

---

## Section 3: Service Times

### Collapsed State
```
┌──────────────────────────────────────────────────────┐
│  ⏱️ Service Times                                   ▼ │
└──────────────────────────────────────────────────────┘
```

### Expanded State (When Enabled)
```
┌──────────────────────────────────────────────────────┐
│  ⏱️ Service Times                     [Enabled]    ▲ │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ⚙️ Enable Service Time Constraints     [ON]         │
│                                                       │
│  ╭───────────────────────────────────────────────╮  │
│  │ Default Service Time (minutes)                 │  │
│  │  [-]  [5]  [+]                                 │  │
│  │                                                │  │
│  │ Time required at each stop for                │  │
│  │ loading/unloading                              │  │
│  ╰───────────────────────────────────────────────╯  │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**Features**:
- Toggle switch to enable/disable service times
- Default service time input with +/- buttons (1-60 minutes)
- Help text explaining purpose
- Applies to all pickup and delivery points

---

## Section 4: Driver Break Times

### Collapsed State
```
┌──────────────────────────────────────────────────────┐
│  ☕ Driver Break Times                              ▼ │
└──────────────────────────────────────────────────────┘
```

### Expanded State (When Enabled)
```
┌──────────────────────────────────────────────────────┐
│  ☕ Driver Break Times                [Enabled]    ▲ │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ⚙️ Enable Break Time Scheduling        [ON]         │
│                                                       │
│  ╭───────────────────────────────────────────────╮  │
│  │ Configure mandatory break times for drivers   │  │
│  │ during long routes (e.g., lunch breaks,       │  │
│  │ rest periods).                                 │  │
│  │                                                │  │
│  │ ⓘ Break times will be automatically scheduled │  │
│  │   between deliveries to comply with driver     │  │
│  │   regulations.                                 │  │
│  ╰───────────────────────────────────────────────╯  │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**Features**:
- Toggle switch to enable/disable break scheduling
- Information panel explaining automatic scheduling
- Breaks are scheduled during route optimization

---

## Section 5: Max Distance & Duration

### Collapsed State
```
┌──────────────────────────────────────────────────────┐
│  🛣️ Max Distance & Duration                         ▼ │
└──────────────────────────────────────────────────────┘
```

### Expanded State (When Enabled)
```
┌──────────────────────────────────────────────────────┐
│  🛣️ Max Distance & Duration          [Enabled]    ▲ │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ⚙️ Enable Max Distance/Duration        [ON]         │
│     Constraints                                       │
│                                                       │
│  ╭───────────────────────────────────────────────╮  │
│  │ Max Distance per Vehicle (km)                  │  │
│  │  [100                                    ]     │  │
│  │                                                │  │
│  │ Max Duration per Vehicle (hours)               │  │
│  │  [8.0                                    ]     │  │
│  ╰───────────────────────────────────────────────╯  │
│                                                       │
│  ╭───────────────────────────────────────────────╮  │
│  │ ⓘ Constraints apply to all vehicles. Routes   │  │
│  │   exceeding these limits will be flagged or    │  │
│  │   rejected.                                    │  │
│  ╰───────────────────────────────────────────────╯  │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**Features**:
- Toggle switch to enable/disable constraints
- Max distance input (1-500 km)
- Max duration input (1-24 hours, 0.5 hour increments)
- Applies to ALL vehicles simultaneously
- Warning about constraint enforcement

---

## User Interactions

### Enabling a Setting
1. Click on the accordion section to expand
2. Toggle the switch to ON
3. Additional controls appear
4. Configure the specific parameters
5. Changes are saved immediately to form state

### Disabling a Setting
1. Toggle the switch to OFF
2. Controls disappear but values are retained
3. Section can be collapsed to save space

### Visual Feedback
- **Enabled Badge**: Green "Enabled" badge appears next to section title when active
- **Toggle Animation**: Smooth on/off animation for switches
- **Accordion Animation**: Smooth expand/collapse with chevron rotation
- **Input Validation**: Real-time validation on number inputs

---

## Icon Legend

| Icon | Meaning |
|------|---------|
| ⚙️ | Settings/Configuration |
| 🕐 | Time Windows |
| ⚖️ | Weight/Capacity |
| ⏱️ | Service Time |
| ☕ | Break Times |
| 🛣️ | Route Distance/Duration |
| ⓘ | Information/Help |
| ▼/▲ | Expand/Collapse |
| [ON]/[OFF] | Toggle State |

---

## Responsive Design

### Desktop View (>1024px)
- Full-width accordion sections
- Side-by-side layout for capacity unit buttons
- Spacious input fields

### Tablet View (768px - 1024px)
- Slightly narrower sections
- Maintains side-by-side layouts
- Readable font sizes

### Mobile View (<768px)
- Stacked layouts for better readability
- Full-width buttons and inputs
- Larger touch targets
- Scrollable vehicle lists

---

## Color Scheme

### Light Mode
```
Background:          #FFFFFF (white)
Card Background:     #F9FAFB (light gray)
Primary:             #3B82F6 (blue)
Text:                #1F2937 (dark gray)
Muted Text:          #6B7280 (medium gray)
Border:              #E5E7EB (light border)
Enabled Badge:       #DBEAFE (light blue bg) + #1E40AF (blue text)
```

### Dark Mode
```
Background:          #111827 (dark)
Card Background:     #1F2937 (medium dark)
Primary:             #60A5FA (light blue)
Text:                #F9FAFB (light gray)
Muted Text:          #9CA3AF (medium gray)
Border:              #374151 (dark border)
Enabled Badge:       #1E3A8A (dark blue bg) + #93C5FD (light blue text)
```

---

## Keyboard Navigation

### Tab Order
1. Time Windows Accordion Trigger
2. Time Windows Toggle (when expanded)
3. Vehicle Capacities Accordion Trigger
4. Vehicle Capacities Toggle (when expanded)
5. Capacity Unit Buttons (when enabled)
6. Vehicle Capacity Inputs (when enabled)
7. Service Times Accordion Trigger
8. Service Times Toggle (when expanded)
9. Default Service Time Input (when enabled)
10. Break Times Accordion Trigger
11. Break Times Toggle (when expanded)
12. Max Distance/Duration Accordion Trigger
13. Max Distance/Duration Toggle (when expanded)
14. Max Distance Input (when enabled)
15. Max Duration Input (when enabled)

### Keyboard Shortcuts
- **Enter/Space**: Toggle accordion sections
- **Enter/Space**: Toggle switches
- **Arrow Up/Down**: Increment/decrement number inputs
- **Tab**: Navigate forward
- **Shift+Tab**: Navigate backward
- **Escape**: Close expanded sections (future enhancement)

---

## Accessibility Features

### Screen Reader Announcements
- "CVRP Advanced Settings section"
- "Time Windows, collapsed/expanded"
- "Enable Time Window Constraints, toggle button, on/off"
- "Capacity unit selector, 3 buttons: kg, liters, units"
- "Vehicle capacity for Riyadh Truck 1, input, value 3000 kg"

### ARIA Labels
All interactive elements have proper ARIA labels:
- `aria-label="Toggle time windows"`
- `aria-label="Select capacity unit"`
- `aria-label="Set vehicle capacity"`
- `aria-expanded="true/false"` on accordion triggers

### Focus Indicators
- Visible focus rings on all interactive elements
- High contrast focus indicators
- Keyboard navigation follows logical flow

---

## Form State Management

### State Structure
```typescript
cvrpSettings: {
  enableTimeWindows: boolean,
  enableCapacityConstraints: boolean,
  enableServiceTimes: boolean,
  enableBreakTimes: boolean,
  enableMaxDistanceDuration: boolean,
  defaultServiceTime: number,
  capacityUnit: 'kg' | 'liters' | 'units'
}
```

### State Updates
- Immutable updates using spread operators
- React state batching for performance
- No unnecessary re-renders

### Form Submission
When user clicks "Optimize Routes":
1. All CVRP settings are collected from state
2. Settings are merged into `OptimizationRequest`
3. Backend receives complete CVRP configuration
4. Optimization engine applies constraints

---

## Best Practices for Users

### When to Use Each Setting

**Time Windows**:
- Customers have specific delivery time requirements
- Pickup locations have operating hours
- Need to respect business hours

**Capacity Constraints**:
- Vehicles have weight/volume limits
- Deliveries have different package sizes
- Need to prevent overloading

**Service Times**:
- Loading/unloading takes significant time
- Need accurate arrival time predictions
- Multiple stops require time buffers

**Break Times**:
- Long routes require driver breaks
- Compliance with labor regulations
- Need to schedule lunch/rest periods

**Max Distance/Duration**:
- Shift time limits (e.g., 8-hour shifts)
- Vehicle range limitations
- Driver availability constraints

---

## Common Use Cases

### Use Case 1: Standard Delivery with Time Windows
```
✓ Enable Time Windows
✗ Enable Capacity Constraints
✗ Enable Service Times
✗ Enable Break Times
✗ Enable Max Distance/Duration
```
Best for: Simple deliveries with customer time preferences

---

### Use Case 2: Heavy Cargo with Capacity Limits
```
✓ Enable Time Windows
✓ Enable Capacity Constraints (set to kg)
✓ Enable Service Times (set to 10 minutes)
✗ Enable Break Times
✗ Enable Max Distance/Duration
```
Best for: Freight delivery with weight restrictions

---

### Use Case 3: Long-Haul Routes with Driver Breaks
```
✓ Enable Time Windows
✓ Enable Capacity Constraints
✓ Enable Service Times
✓ Enable Break Times
✓ Enable Max Distance/Duration (8 hours)
```
Best for: Full-day routes requiring break compliance

---

### Use Case 4: Quick Local Deliveries
```
✓ Enable Time Windows
✗ Enable Capacity Constraints
✓ Enable Service Times (set to 3 minutes)
✗ Enable Break Times
✗ Enable Max Distance/Duration
```
Best for: Fast food delivery, courier services

---

## Troubleshooting

### Issue: Accordion sections won't open
**Solution**: Check if JavaScript is enabled, verify React is loaded

### Issue: Toggle switches not responding
**Solution**: Check for JavaScript errors in console, verify state updates

### Issue: Vehicle capacities not saving
**Solution**: Ensure inputs are within valid range (0-999999)

### Issue: Form submission fails with CVRP settings
**Solution**: Verify all required fields are filled, check backend logs

---

## Future Enhancements (Roadmap)

### Phase 2
- [ ] Per-point service time editor
- [ ] Visual break time scheduler
- [ ] Demand editor for delivery points
- [ ] Vehicle-specific max distance/duration

### Phase 3
- [ ] CVRP setting templates
- [ ] Save/load presets
- [ ] Constraint conflict detection
- [ ] Real-time feasibility checking

### Phase 4
- [ ] Advanced time window editor
- [ ] Multiple time windows per point
- [ ] Cost estimation preview
- [ ] Constraint impact visualization

---

**Last Updated**: November 17, 2025
**Version**: 1.0
**Status**: Production Ready
