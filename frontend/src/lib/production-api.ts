/**
 * Production Data API Client
 *
 * Client for accessing real BarqFleet production database statistics
 * and operational data through the backend API
 */

import { apiClient } from './api-client';

// Type Definitions
export interface ProductionStatistics {
  success: boolean;
  data: {
    total_orders: number;
    total_couriers: number;
    total_hubs: number;
    total_shipments: number;
    today_orders: number;
    pending_orders: number;
    online_couriers: number;
    active_shipments: number;
  };
}

export interface ProductionHub {
  id: number;
  code: string;
  manager: string;
  mobile: string;
  latitude: number;
  longitude: number;
  city_id: number;
  is_active: boolean;
  is_open: boolean;
  bundle_limit: number;
  dispatch_radius: number;
  max_distance: number;
  hub_type: string;
  street_name: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionCourier {
  id: number;
  mobile: string;
  first_name: string;
  last_name: string;
  is_online: boolean;
  is_busy: boolean;
  is_banned: boolean;
  city_id: number;
  vehicle_type: string;
  latitude: number;
  longitude: number;
  trust_level: number;
  courier_type: string;
  hub_id: number;
  created_at: string;
  updated_at: string;
}

export interface ProductionOrder {
  id: number;
  tracking_no: string;
  merchant_id: number;
  hub_id: number;
  shipment_id: number | null;
  order_status: string;
  payment_type: string;
  delivery_fee: number;
  grand_total: number;
  customer_details: any;
  origin: any;
  destination: any;
  products: any;
  is_assigned: boolean;
  is_completed: boolean;
  delivery_start: string | null;
  delivery_finish: string | null;
  cod_fee: number;
  created_at: string;
  updated_at: string;
  merchant_name: string;
  hub_code: string;
  hub_manager: string;
}

export interface ProductionShipment {
  id: number;
  courier_id: number;
  is_assigned: boolean;
  is_completed: boolean;
  latitude: number;
  longitude: number;
  reward: number;
  total_distance: number;
  created_at: string;
  updated_at: string;
  courier_first_name: string;
  courier_last_name: string;
  courier_mobile: string;
  hub_code: string | null;
  hub_manager: string | null;
  order_count: number;
}

/**
 * Production Data API Client Class
 */
class ProductionAPIClient {
  /**
   * Test connection to production database
   */
  async testConnection(): Promise<{ success: boolean; timestamp?: string; error?: string }> {
    try {
      return await apiClient.get('/barq-production/test-connection');
    } catch (error) {
      console.error('Production connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get production database statistics
   */
  async getStatistics(): Promise<ProductionStatistics> {
    try {
      return await apiClient.get('/barq-production/statistics');
    } catch (error) {
      console.error('Failed to fetch production statistics:', error);
      throw error;
    }
  }

  /**
   * Get pending orders from production
   */
  async getPendingOrders(hubId?: number, limit: number = 100): Promise<{ success: boolean; count: number; data: ProductionOrder[] }> {
    try {
      const params = new URLSearchParams();
      if (hubId) params.append('hub_id', hubId.toString());
      if (limit) params.append('limit', limit.toString());

      const queryString = params.toString();
      const endpoint = `/barq-production/orders/pending${queryString ? `?${queryString}` : ''}`;

      return await apiClient.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch pending orders:', error);
      throw error;
    }
  }

  /**
   * Get available couriers from production
   */
  async getAvailableCouriers(cityId?: number, limit: number = 100): Promise<{ success: boolean; count: number; data: ProductionCourier[] }> {
    try {
      const params = new URLSearchParams();
      if (cityId) params.append('city_id', cityId.toString());
      if (limit) params.append('limit', limit.toString());

      const queryString = params.toString();
      const endpoint = `/barq-production/couriers/available${queryString ? `?${queryString}` : ''}`;

      return await apiClient.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch available couriers:', error);
      throw error;
    }
  }

  /**
   * Get active shipments from production
   */
  async getActiveShipments(limit: number = 100): Promise<{ success: boolean; count: number; data: ProductionShipment[] }> {
    try {
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());

      const queryString = params.toString();
      const endpoint = `/barq-production/shipments/active${queryString ? `?${queryString}` : ''}`;

      return await apiClient.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch active shipments:', error);
      throw error;
    }
  }

  /**
   * Get all hubs from production
   */
  async getHubs(filters?: {
    is_active?: boolean;
    city_id?: number;
    limit?: number;
  }): Promise<{ success: boolean; count: number; data: ProductionHub[] }> {
    try {
      const params = new URLSearchParams();
      if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
      if (filters?.city_id) params.append('city_id', filters.city_id.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const queryString = params.toString();
      const endpoint = `/barq-production/hubs${queryString ? `?${queryString}` : ''}`;

      return await apiClient.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch hubs:', error);
      throw error;
    }
  }

  /**
   * Get all couriers from production
   */
  async getCouriers(filters?: {
    is_online?: boolean;
    is_banned?: boolean;
    city_id?: number;
    limit?: number;
  }): Promise<{ success: boolean; count: number; data: ProductionCourier[] }> {
    try {
      const params = new URLSearchParams();
      if (filters?.is_online !== undefined) params.append('is_online', filters.is_online.toString());
      if (filters?.is_banned !== undefined) params.append('is_banned', filters.is_banned.toString());
      if (filters?.city_id) params.append('city_id', filters.city_id.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const queryString = params.toString();
      const endpoint = `/barq-production/couriers${queryString ? `?${queryString}` : ''}`;

      return await apiClient.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch couriers:', error);
      throw error;
    }
  }

  /**
   * Get all orders from production
   */
  async getOrders(filters?: {
    order_status?: string | string[];
    hub_id?: number;
    merchant_id?: number;
    created_after?: string;
    created_before?: string;
    limit?: number;
  }): Promise<{ success: boolean; count: number; data: ProductionOrder[] }> {
    try {
      const params = new URLSearchParams();
      if (filters?.order_status) {
        if (Array.isArray(filters.order_status)) {
          filters.order_status.forEach(status => params.append('order_status', status));
        } else {
          params.append('order_status', filters.order_status);
        }
      }
      if (filters?.hub_id) params.append('hub_id', filters.hub_id.toString());
      if (filters?.merchant_id) params.append('merchant_id', filters.merchant_id.toString());
      if (filters?.created_after) params.append('created_after', filters.created_after);
      if (filters?.created_before) params.append('created_before', filters.created_before);
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const queryString = params.toString();
      const endpoint = `/barq-production/orders${queryString ? `?${queryString}` : ''}`;

      return await apiClient.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      throw error;
    }
  }

  /**
   * Get all shipments from production
   */
  async getShipments(filters?: {
    is_completed?: boolean;
    is_assigned?: boolean;
    courier_id?: number;
    limit?: number;
  }): Promise<{ success: boolean; count: number; data: ProductionShipment[] }> {
    try {
      const params = new URLSearchParams();
      if (filters?.is_completed !== undefined) params.append('is_completed', filters.is_completed.toString());
      if (filters?.is_assigned !== undefined) params.append('is_assigned', filters.is_assigned.toString());
      if (filters?.courier_id) params.append('courier_id', filters.courier_id.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const queryString = params.toString();
      const endpoint = `/barq-production/shipments${queryString ? `?${queryString}` : ''}`;

      return await apiClient.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch shipments:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const productionAPI = new ProductionAPIClient();

// Export class for custom instances if needed
export default ProductionAPIClient;
