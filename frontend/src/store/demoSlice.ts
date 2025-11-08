import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Order {
  id: string;
  serviceType: 'BARQ' | 'BULLET';
  status: 'pending' | 'assigned' | 'picked_up' | 'delivered' | 'failed';
  pickup: {
    address: string;
    coordinates: { lat: number; lng: number };
    businessName?: string;
  };
  dropoff: {
    address: string;
    coordinates: { lat: number; lng: number };
    customerName?: string;
  };
  driverId?: string;
  createdAt: string;
  assignedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  estimatedDeliveryTime?: number;
  sla: number;
}

export interface Driver {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'offline';
  location: { lat: number; lng: number };
  currentOrders: string[];
  vehicleType?: string;
  completedToday?: number;
}

export interface DemoMetrics {
  totalOrders: number;
  completedOrders: number;
  failedOrders: number;
  activeOrders: number;
  averageDeliveryTime: number;
  slaCompliance: number;
  activeDrivers: number;
  busyDrivers: number;
}

export interface DemoEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  level?: 'info' | 'warning' | 'error' | 'success';
}

interface DemoState {
  isRunning: boolean;
  isConnected: boolean;
  orders: Order[];
  drivers: Driver[];
  metrics: DemoMetrics;
  events: DemoEvent[];
  config: {
    ordersPerMinute: number;
    durationMinutes: number;
    serviceTypeMix: {
      BARQ: number;
      BULLET: number;
    };
  };
}

const initialState: DemoState = {
  isRunning: false,
  isConnected: false,
  orders: [],
  drivers: [],
  metrics: {
    totalOrders: 0,
    completedOrders: 0,
    failedOrders: 0,
    activeOrders: 0,
    averageDeliveryTime: 0,
    slaCompliance: 100,
    activeDrivers: 0,
    busyDrivers: 0,
  },
  events: [],
  config: {
    ordersPerMinute: 5,
    durationMinutes: 5,
    serviceTypeMix: {
      BARQ: 0.6,
      BULLET: 0.4,
    },
  },
};

const demoSlice = createSlice({
  name: 'demo',
  initialState,
  reducers: {
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },

    setDemoStatus: (state, action: PayloadAction<boolean>) => {
      state.isRunning = action.payload;
    },

    setConfig: (state, action: PayloadAction<Partial<DemoState['config']>>) => {
      state.config = { ...state.config, ...action.payload };
    },

    addOrder: (state, action: PayloadAction<Order>) => {
      // Add to beginning and keep only last 50 orders
      state.orders = [action.payload, ...state.orders].slice(0, 50);
      state.metrics.totalOrders++;
      state.metrics.activeOrders = state.orders.filter(
        (o) => !['delivered', 'failed'].includes(o.status)
      ).length;
    },

    updateOrder: (state, action: PayloadAction<Partial<Order> & { id: string }>) => {
      const index = state.orders.findIndex((o) => o.id === action.payload.id);
      if (index !== -1) {
        state.orders[index] = { ...state.orders[index], ...action.payload };

        // Update metrics
        if (action.payload.status === 'delivered') {
          state.metrics.completedOrders++;
        } else if (action.payload.status === 'failed') {
          state.metrics.failedOrders++;
        }

        state.metrics.activeOrders = state.orders.filter(
          (o) => !['delivered', 'failed'].includes(o.status)
        ).length;
      }
    },

    setDrivers: (state, action: PayloadAction<Driver[]>) => {
      state.drivers = action.payload;
      state.metrics.activeDrivers = action.payload.filter((d) => d.status !== 'offline').length;
      state.metrics.busyDrivers = action.payload.filter((d) => d.status === 'busy').length;
    },

    updateDriver: (state, action: PayloadAction<Driver>) => {
      const index = state.drivers.findIndex((d) => d.id === action.payload.id);
      if (index !== -1) {
        state.drivers[index] = action.payload;
      } else {
        state.drivers.push(action.payload);
      }

      state.metrics.activeDrivers = state.drivers.filter((d) => d.status !== 'offline').length;
      state.metrics.busyDrivers = state.drivers.filter((d) => d.status === 'busy').length;
    },

    updateMetrics: (state, action: PayloadAction<Partial<DemoMetrics>>) => {
      state.metrics = { ...state.metrics, ...action.payload };
    },

    addEvent: (state, action: PayloadAction<DemoEvent>) => {
      // Add to beginning and keep only last 100 events
      state.events = [action.payload, ...state.events].slice(0, 100);
    },

    clearEvents: (state) => {
      state.events = [];
    },

    resetDemo: (state) => {
      return { ...initialState, isConnected: state.isConnected };
    },
  },
});

export const {
  setConnectionStatus,
  setDemoStatus,
  setConfig,
  addOrder,
  updateOrder,
  setDrivers,
  updateDriver,
  updateMetrics,
  addEvent,
  clearEvents,
  resetDemo,
} = demoSlice.actions;

export default demoSlice.reducer;
