/**
 * Agent Controller
 * Handles requests to the agent system for demo and production use
 */

const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

// Import all agents
const MasterOrchestrator = require('../agents/master-orchestrator.agent');
const FleetStatusAgent = require('../agents/fleet-status.agent');
const SLAMonitorAgent = require('../agents/sla-monitor.agent');
const OrderAssignmentAgent = require('../agents/order-assignment.agent');
const RouteOptimizationAgent = require('../agents/route-optimization.agent');

class AgentController extends EventEmitter {
  constructor() {
    super();

    // Initialize agents
    this.agents = {
      masterOrchestrator: new MasterOrchestrator(),
      fleetStatus: new FleetStatusAgent(),
      slaMonitor: new SLAMonitorAgent(),
      orderAssignment: new OrderAssignmentAgent(),
      routeOptimization: new RouteOptimizationAgent(),
    };

    // Order tracking
    this.orders = new Map();
    this.drivers = new Map();

    logger.info('Agent Controller initialized');
  }

  /**
   * Process a new order through the agent system
   */
  async processNewOrder(order) {
    try {
      logger.info('Processing new order through agent system', {
        orderId: order.id,
        serviceType: order.serviceType,
      });

      // Store order
      this.orders.set(order.id, order);

      // Emit order created event
      this.emit('orderCreated', order);

      // Step 1: Check available drivers through Fleet Status Agent
      const availableDrivers = await this.agents.fleetStatus.getAvailableDrivers({
        location: order.pickup.coordinates,
        serviceType: order.serviceType,
      });

      if (availableDrivers.length === 0) {
        logger.warn('No available drivers for order', { orderId: order.id });
        order.status = 'pending_driver';
        this.emit('orderPending', { orderId: order.id, reason: 'No available drivers' });
        return order;
      }

      // Step 2: Score and assign driver through Order Assignment Agent
      const assignment = await this.agents.orderAssignment.assignOrder({
        order,
        drivers: availableDrivers,
      });

      if (!assignment.success) {
        logger.warn('Failed to assign order', { orderId: order.id });
        order.status = 'failed_assignment';
        this.emit('orderFailed', { orderId: order.id, reason: assignment.reason });
        return order;
      }

      // Update order with assignment
      order.driverId = assignment.driverId;
      order.status = 'assigned';
      order.assignedAt = new Date().toISOString();

      // Update driver status
      const driver = this.drivers.get(assignment.driverId);
      if (driver) {
        driver.status = 'busy';
        driver.currentOrders = (driver.currentOrders || []).concat(order.id);
      }

      // Emit assignment event
      this.emit('orderAssigned', {
        orderId: order.id,
        driverId: assignment.driverId,
        estimatedPickupTime: assignment.estimatedPickupTime,
      });

      // Step 3: Optimize route through Route Optimization Agent
      const route = await this.agents.routeOptimization.optimizeRoute({
        driverId: assignment.driverId,
        orders: [order],
        currentLocation: assignment.driverLocation,
      });

      if (route.success) {
        order.route = route.path;
        order.estimatedDeliveryTime = route.estimatedDeliveryTime;

        this.emit('routeOptimized', {
          orderId: order.id,
          driverId: assignment.driverId,
          route: route.path,
        });
      }

      // Step 4: Monitor SLA through SLA Monitor Agent
      const slaCheck = await this.agents.slaMonitor.checkSLA({
        order,
        currentTime: new Date().toISOString(),
      });

      if (slaCheck.atRisk) {
        this.emit('slaAlert', {
          orderId: order.id,
          level: slaCheck.level,
          message: slaCheck.message,
        });
      }

      return order;
    } catch (error) {
      logger.error('Error processing order', {
        orderId: order.id,
        error: error.message,
      });

      order.status = 'error';
      this.emit('orderError', { orderId: order.id, error: error.message });

      throw error;
    }
  }

  /**
   * Register a driver in the system
   */
  async registerDriver(driver) {
    try {
      logger.info('Registering driver', { driverId: driver.id });

      // Store driver
      this.drivers.set(driver.id, driver);

      // Register with Fleet Status Agent
      await this.agents.fleetStatus.registerDriver({
        id: driver.id,
        name: driver.name,
        location: driver.location,
        status: driver.status,
        vehicleType: driver.vehicleType,
        capacity: driver.capacity,
      });

      this.emit('driverRegistered', driver);

      return { success: true, driverId: driver.id };
    } catch (error) {
      logger.error('Error registering driver', {
        driverId: driver.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update driver location
   */
  async updateDriverLocation(driverId, location) {
    try {
      const driver = this.drivers.get(driverId);
      if (!driver) {
        throw new Error(`Driver ${driverId} not found`);
      }

      driver.location = location;
      driver.lastUpdated = new Date().toISOString();

      // Update in Fleet Status Agent
      await this.agents.fleetStatus.updateDriverLocation({
        driverId,
        location,
      });

      this.emit('driverLocationUpdated', {
        driverId,
        location,
      });

      return { success: true };
    } catch (error) {
      logger.error('Error updating driver location', {
        driverId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, status, metadata = {}) {
    try {
      const order = this.orders.get(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      const previousStatus = order.status;
      order.status = status;
      order.lastUpdated = new Date().toISOString();

      // Add status-specific timestamps
      switch (status) {
        case 'picked_up':
          order.pickedUpAt = new Date().toISOString();
          this.emit('orderPickedUp', { orderId, driverId: order.driverId });
          break;

        case 'delivered':
          order.deliveredAt = new Date().toISOString();
          order.deliveryTime = this.calculateDeliveryTime(order);

          // Update driver status
          const driver = this.drivers.get(order.driverId);
          if (driver) {
            driver.currentOrders = driver.currentOrders.filter((id) => id !== orderId);
            if (driver.currentOrders.length === 0) {
              driver.status = 'available';
            }
            driver.completedToday = (driver.completedToday || 0) + 1;
          }

          // Check SLA compliance
          const slaCompliant = this.checkSLACompliance(order);
          order.slaCompliant = slaCompliant;

          this.emit('orderDelivered', {
            orderId,
            driverId: order.driverId,
            deliveryTime: order.deliveryTime,
            slaCompliant,
          });
          break;

        case 'failed':
          order.failedAt = new Date().toISOString();
          order.failureReason = metadata.reason || 'Unknown';

          // Release driver
          const failedDriver = this.drivers.get(order.driverId);
          if (failedDriver) {
            failedDriver.currentOrders = failedDriver.currentOrders.filter((id) => id !== orderId);
            if (failedDriver.currentOrders.length === 0) {
              failedDriver.status = 'available';
            }
          }

          this.emit('orderFailed', {
            orderId,
            reason: order.failureReason,
          });
          break;
      }

      logger.info('Order status updated', {
        orderId,
        previousStatus,
        newStatus: status,
      });

      return { success: true, order };
    } catch (error) {
      logger.error('Error updating order status', {
        orderId,
        status,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get system metrics
   */
  getMetrics() {
    const orders = Array.from(this.orders.values());
    const drivers = Array.from(this.drivers.values());

    const metrics = {
      totalOrders: orders.length,
      completedOrders: orders.filter((o) => o.status === 'delivered').length,
      failedOrders: orders.filter((o) => o.status === 'failed').length,
      pendingOrders: orders.filter((o) => o.status === 'pending').length,
      activeOrders: orders.filter((o) => ['assigned', 'picked_up'].includes(o.status)).length,

      totalDrivers: drivers.length,
      availableDrivers: drivers.filter((d) => d.status === 'available').length,
      busyDrivers: drivers.filter((d) => d.status === 'busy').length,
      offlineDrivers: drivers.filter((d) => d.status === 'offline').length,

      averageDeliveryTime: this.calculateAverageDeliveryTime(orders),
      slaCompliance: this.calculateSLACompliance(orders),

      ordersByServiceType: {
        BARQ: orders.filter((o) => o.serviceType === 'BARQ').length,
        BULLET: orders.filter((o) => o.serviceType === 'BULLET').length,
      },
    };

    return metrics;
  }

  /**
   * Calculate delivery time in minutes
   */
  calculateDeliveryTime(order) {
    if (!order.createdAt || !order.deliveredAt) {
      return 0;
    }

    const created = new Date(order.createdAt);
    const delivered = new Date(order.deliveredAt);
    const diffMs = delivered - created;
    return Math.round(diffMs / 60000); // Convert to minutes
  }

  /**
   * Check if order met SLA
   */
  checkSLACompliance(order) {
    const deliveryTime = this.calculateDeliveryTime(order);
    return deliveryTime <= order.sla;
  }

  /**
   * Calculate average delivery time
   */
  calculateAverageDeliveryTime(orders) {
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    if (deliveredOrders.length === 0) return 0;

    const totalTime = deliveredOrders.reduce((sum, order) => {
      return sum + (order.deliveryTime || 0);
    }, 0);

    return Math.round(totalTime / deliveredOrders.length);
  }

  /**
   * Calculate SLA compliance percentage
   */
  calculateSLACompliance(orders) {
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    if (deliveredOrders.length === 0) return 100;

    const compliantOrders = deliveredOrders.filter((o) => o.slaCompliant);
    return Math.round((compliantOrders.length / deliveredOrders.length) * 100);
  }

  /**
   * Reset system (for demo purposes)
   */
  reset() {
    this.orders.clear();
    this.drivers.clear();
    logger.info('Agent Controller reset');
  }
}

// Export singleton instance
module.exports = new AgentController();
