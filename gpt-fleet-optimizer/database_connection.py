#!/usr/bin/env python3
"""
Robust Database Connection Handler for BarqFleet Analytics
Provides resilient database connectivity with retry logic, circuit breaker pattern,
and automatic fallback to demo data when production is unavailable.
"""

import os
import sys
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
import numpy as np
from contextlib import contextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CircuitBreaker:
    """Circuit breaker implementation to prevent repeated failed connection attempts."""
    
    def __init__(self, failure_threshold=3, reset_timeout=60, expected_exception=Exception):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.expected_exception = expected_exception
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
        
    def __call__(self, func):
        def wrapper(*args, **kwargs):
            if self.state == 'OPEN':
                if self._should_attempt_reset():
                    self.state = 'HALF_OPEN'
                else:
                    raise Exception(f"Circuit breaker is OPEN. Database unavailable. Next retry in {self._time_to_reset():.0f}s")
            
            try:
                result = func(*args, **kwargs)
                self._on_success()
                return result
            except self.expected_exception as e:
                self._on_failure()
                raise e
                
        return wrapper
    
    def _should_attempt_reset(self):
        return (
            self.last_failure_time and 
            time.time() - self.last_failure_time >= self.reset_timeout
        )
    
    def _time_to_reset(self):
        if self.last_failure_time:
            return self.reset_timeout - (time.time() - self.last_failure_time)
        return 0
    
    def _on_success(self):
        self.failure_count = 0
        self.state = 'CLOSED'
        
    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = 'OPEN'
            logger.warning(f"Circuit breaker opened after {self.failure_count} failures")


class DatabaseConnection:
    """Resilient database connection handler with fallback capabilities."""
    
    def __init__(self, config: Dict[str, str] = None, enable_fallback: bool = False):
        """
        Initialize database connection handler.
        
        Args:
            config: Database configuration. If None, reads from environment.
            enable_fallback: Whether to use demo data fallback when production fails.
        """
        self.config = config or self._get_default_config()
        self.enable_fallback = enable_fallback
        self.conn = None
        self.is_fallback_mode = False
        self.connection_pool = {}
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=3,
            reset_timeout=120,  # 2 minutes
            expected_exception=(psycopg2.Error, psycopg2.OperationalError)
        )
        
        # Demo data for fallback
        self.demo_data = {}
        self._initialize_demo_data()
        
    def _get_default_config(self) -> Dict[str, str]:
        """Get default database configuration from environment variables."""
        return {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': int(os.getenv('DB_PORT', 5432)),
            'database': os.getenv('DB_NAME', 'barqfleet_db'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD', 'postgres'),
            'connect_timeout': 10,
            'application_name': 'BarqFleet_Analytics'
        }
    
    def connect(self, retry_attempts: int = 3, base_delay: float = 2.0) -> bool:
        """
        Establish database connection with retry logic and exponential backoff.
        
        Args:
            retry_attempts: Number of retry attempts (default: 3)
            base_delay: Base delay for exponential backoff in seconds (default: 2.0)
            
        Returns:
            bool: True if connected to production, False if using fallback
        """
        # Check circuit breaker state
        if self.circuit_breaker.state == 'OPEN':
            if self.circuit_breaker._should_attempt_reset():
                self.circuit_breaker.state = 'HALF_OPEN'
                logger.info("Circuit breaker attempting reset...")
            else:
                logger.warning(f"Circuit breaker is OPEN. Next retry in {self.circuit_breaker._time_to_reset():.0f}s")
                if self.enable_fallback:
                    self._activate_fallback_mode()
                    return False
                else:
                    raise Exception(f"Circuit breaker is OPEN. Database unavailable.")
        
        for attempt in range(retry_attempts):
            try:
                self.conn = psycopg2.connect(**self.config)
                self.is_fallback_mode = False
                self.circuit_breaker._on_success()
                logger.info("✓ Connected to BarqFleet production database successfully")
                return True
                
            except (psycopg2.Error, psycopg2.OperationalError) as e:
                self.circuit_breaker._on_failure()
                delay = base_delay * (2 ** attempt)  # Exponential backoff
                logger.warning(f"Database connection attempt {attempt + 1}/{retry_attempts} failed: {e}")
                
                if attempt < retry_attempts - 1:
                    logger.info(f"Retrying in {delay:.1f} seconds...")
                    time.sleep(delay)
                else:
                    logger.error("All database connection attempts failed")
                    if self.enable_fallback:
                        self._activate_fallback_mode()
                        return False
                    else:
                        raise e
        
        return False
    
    def _activate_fallback_mode(self):
        """Activate fallback mode with demo data."""
        self.is_fallback_mode = True
        logger.warning("⚠ Activating fallback mode with demo data")
        logger.info("Using realistic Saudi Arabian fleet data for analytics")
        
    def disconnect(self):
        """Close database connection."""
        if self.conn and not self.is_fallback_mode:
            self.conn.close()
            logger.info("✓ Database connection closed")
        
    @contextmanager
    def get_cursor(self):
        """Get database cursor with automatic transaction management."""
        if self.is_fallback_mode:
            # Return a mock cursor for fallback mode
            yield MockCursor(self.demo_data)
            return
            
        if not self.conn:
            raise Exception("Database connection not established")
            
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        try:
            yield cursor
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Database transaction failed: {e}")
            raise e
        finally:
            cursor.close()
    
    def execute_query(self, query: str, params: List = None, timeout: float = 30.0) -> List[Dict]:
        """
        Execute query with timeout and error handling.
        
        Args:
            query: SQL query to execute
            params: Query parameters
            timeout: Query timeout in seconds
            
        Returns:
            List of dictionaries with query results
        """
        if self.is_fallback_mode:
            return self._execute_fallback_query(query, params)
            
        with self.get_cursor() as cursor:
            try:
                cursor.execute(query, params or [])
                
                # Handle different query types
                if query.strip().upper().startswith(('SELECT', 'WITH')):
                    results = cursor.fetchall()
                    return [dict(row) for row in results]
                else:
                    return [{'affected_rows': cursor.rowcount}]
                    
            except psycopg2.OperationalError as e:
                if 'timeout' in str(e).lower():
                    logger.error(f"Query timeout after {timeout}s: {query[:100]}...")
                    raise Exception(f"Query timeout ({timeout}s)")
                else:
                    logger.error(f"Database operational error: {e}")
                    raise e
    
    def _execute_fallback_query(self, query: str, params: List = None) -> List[Dict]:
        """Execute query against demo data in fallback mode."""
        logger.info(f"Executing query in fallback mode: {query[:100]}...")
        
        # Simple query parsing for demo data
        query_lower = query.lower()
        
        if 'orders' in query_lower and 'shipments' in query_lower:
            return self._generate_route_analysis_demo_data(query, params)
        elif 'orders' in query_lower and ('count' in query_lower or 'group by' in query_lower):
            return self._generate_demand_forecast_demo_data(query, params)
        elif 'shipments' in query_lower and 'courier' in query_lower:
            return self._generate_fleet_performance_demo_data(query, params)
        else:
            # Generic demo response
            return self._generate_generic_demo_data()
    
    def _initialize_demo_data(self):
        """Initialize demo data for fallback mode."""
        # Saudi Arabian cities and realistic Arabic names
        saudi_cities = [
            'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 
            'الخبر', 'الطائف', 'بريدة', 'تبوك', 'أبها', 'نجران', 'جيزان'
        ]
        
        arabic_first_names = [
            'محمد', 'أحمد', 'عبدالله', 'سالم', 'خالد', 'عبدالرحمن', 'فيصل', 
            'عمر', 'يوسف', 'إبراهيم', 'سعد', 'فهد', 'ماجد', 'نواف'
        ]
        
        arabic_family_names = [
            'العتيبي', 'المطيري', 'الدوسري', 'القحطاني', 'الغامدي', 'الزهراني', 
            'الشهري', 'الحربي', 'العنزي', 'السبيعي', 'الشمري', 'البقمي'
        ]
        
        # Initialize demo data structure
        self.demo_data = {
            'cities': saudi_cities,
            'first_names': arabic_first_names,
            'family_names': arabic_family_names,
            'base_date': datetime.now() - timedelta(days=90),
            'order_count': 52000,
            'courier_count': 850,
            'hub_count': 120,
            'delivery_success_rate': 0.94
        }
    
    def _generate_route_analysis_demo_data(self, query: str, params: List = None) -> List[Dict]:
        """Generate realistic demo data for route analysis queries."""
        # Simulate route efficiency data
        results = []
        for hub_id in range(1, 21):  # Top 20 hubs
            city = np.random.choice(self.demo_data['cities'])
            
            results.append({
                'hub_id': hub_id,
                'hub_name': f"مركز {city}",
                'total_deliveries': np.random.randint(800, 2500),
                'couriers_used': np.random.randint(15, 45),
                'avg_distance_km': round(np.random.uniform(8.5, 25.3), 1),
                'avg_delivery_time': round(np.random.uniform(22, 48), 1),
                'success_rate': round(np.random.uniform(0.88, 0.98), 3),
                'efficiency_score': round(np.random.uniform(72, 96), 1),
                'on_time_rate': round(np.random.uniform(0.82, 0.95), 3)
            })
            
        return sorted(results, key=lambda x: x['efficiency_score'], reverse=True)
    
    def _generate_demand_forecast_demo_data(self, query: str, params: List = None) -> List[Dict]:
        """Generate realistic demo data for demand forecasting queries."""
        results = []
        base_date = self.demo_data['base_date']
        
        # Generate daily demand patterns for last 90 days
        for day_offset in range(90):
            date = base_date + timedelta(days=day_offset)
            dow = date.weekday()
            
            # Weekend patterns (Friday-Saturday in Saudi Arabia)
            if dow in [4, 5]:  # Friday, Saturday
                base_orders = np.random.randint(180, 280)
            else:
                base_orders = np.random.randint(420, 780)
            
            # Add hourly breakdown for recent days
            if day_offset >= 85:  # Last 5 days
                for hour in range(24):
                    if 8 <= hour <= 23:  # Business hours
                        hourly_orders = max(1, int(base_orders * np.random.uniform(0.02, 0.08)))
                    else:
                        hourly_orders = max(0, int(base_orders * np.random.uniform(0.001, 0.01)))
                        
                    results.append({
                        'order_date': date.strftime('%Y-%m-%d'),
                        'day_of_week': dow,
                        'hour_of_day': hour,
                        'order_count': hourly_orders
                    })
            else:
                results.append({
                    'order_date': date.strftime('%Y-%m-%d'),
                    'day_of_week': dow,
                    'hour_of_day': None,
                    'order_count': base_orders
                })
        
        return results
    
    def _generate_fleet_performance_demo_data(self, query: str, params: List = None) -> List[Dict]:
        """Generate realistic demo data for fleet performance queries."""
        results = []
        
        # Generate courier performance data
        for courier_id in range(1, 101):  # Top 100 couriers
            first_name = np.random.choice(self.demo_data['first_names'])
            family_name = np.random.choice(self.demo_data['family_names'])
            hub = np.random.choice(self.demo_data['cities'])
            
            results.append({
                'courier_id': courier_id,
                'courier_name': f"{first_name} {family_name}",
                'hub_name': f"مركز {hub}",
                'total_deliveries': np.random.randint(180, 450),
                'successful_deliveries': np.random.randint(160, 430),
                'avg_delivery_time': round(np.random.uniform(18, 42), 1),
                'total_distance': round(np.random.uniform(2800, 8500), 1),
                'fuel_efficiency': round(np.random.uniform(6.2, 12.8), 1),
                'customer_rating': round(np.random.uniform(4.1, 4.9), 1),
                'on_time_rate': round(np.random.uniform(0.78, 0.94), 3),
                'vehicle_type': np.random.choice(['دراجة نارية', 'سيارة صغيرة', 'فان'])
            })
        
        return sorted(results, key=lambda x: x['successful_deliveries'], reverse=True)
    
    def _generate_generic_demo_data(self) -> List[Dict]:
        """Generate generic demo data for unknown queries."""
        return [{
            'message': 'Demo data mode active',
            'data_source': 'fallback',
            'timestamp': datetime.now().isoformat(),
            'records_simulated': np.random.randint(100, 1000)
        }]
    
    def get_connection_status(self) -> Dict:
        """Get current connection status and health information."""
        status = {
            'connected': self.conn is not None and not self.is_fallback_mode,
            'fallback_mode': self.is_fallback_mode,
            'circuit_breaker_state': self.circuit_breaker.state,
            'config': {
                'host': self.config.get('host', 'unknown'),
                'database': self.config.get('database', 'unknown'),
                'port': self.config.get('port', 'unknown')
            }
        }
        
        if self.is_fallback_mode:
            status['data_source'] = 'demo'
            status['demo_info'] = {
                'order_count': self.demo_data['order_count'],
                'courier_count': self.demo_data['courier_count'],
                'hub_count': self.demo_data['hub_count']
            }
        else:
            status['data_source'] = 'production'
            
        return status


class MockCursor:
    """Mock cursor for fallback mode operations."""
    
    def __init__(self, demo_data):
        self.demo_data = demo_data
        self.rowcount = 0
        
    def execute(self, query, params=None):
        """Mock execute method."""
        self.rowcount = np.random.randint(50, 500)
        
    def fetchall(self):
        """Mock fetchall method."""
        # Return empty list for now, actual implementation would parse query
        return []
        
    def close(self):
        """Mock close method."""
        pass


def get_database_connection(enable_fallback: bool = False) -> DatabaseConnection:
    """
    Factory function to get a configured database connection.
    
    Args:
        enable_fallback: Whether to enable demo data fallback
        
    Returns:
        DatabaseConnection instance
    """
    return DatabaseConnection(enable_fallback=enable_fallback)


# Health check functions
def test_connection(config: Dict[str, str] = None) -> Dict:
    """
    Quick test of database connectivity without detailed health checks.
    
    Args:
        config: Database configuration
        
    Returns:
        Dictionary with basic connectivity test results
    """
    try:
        db = DatabaseConnection(config, enable_fallback=False)
        connected = db.connect(retry_attempts=1)
        status = db.get_connection_status()
        db.disconnect()
        
        return {
            'success': True,
            'connected': connected,
            'fallback_mode': status['fallback_mode'],
            'data_source': status['data_source'],
            'status': 'healthy' if connected else 'fallback_active',
            'info': 'Production database available' if connected else 'Using demo data'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'status': 'error',
            'info': 'Database connection failed'
        }


def test_database_connectivity(config: Dict[str, str] = None) -> Dict:
    """
    Test database connectivity and return status information.
    
    Args:
        config: Database configuration
        
    Returns:
        Dictionary with connectivity test results
    """
    db = DatabaseConnection(config, enable_fallback=False)
    
    start_time = time.time()
    try:
        success = db.connect(retry_attempts=1)
        connection_time = time.time() - start_time
        
        if success:
            # Test a simple query
            query_start = time.time()
            result = db.execute_query("SELECT 1 as test")
            query_time = time.time() - query_start
            
            db.disconnect()
            
            return {
                'status': 'healthy',
                'connection_time_ms': round(connection_time * 1000, 2),
                'query_time_ms': round(query_time * 1000, 2),
                'data_source': 'production'
            }
        else:
            return {
                'status': 'failed',
                'connection_time_ms': round(connection_time * 1000, 2),
                'error': 'Connection failed',
                'data_source': 'unavailable'
            }
            
    except Exception as e:
        connection_time = time.time() - start_time
        return {
            'status': 'error',
            'connection_time_ms': round(connection_time * 1000, 2),
            'error': str(e),
            'data_source': 'unavailable'
        }


if __name__ == "__main__":
    """Test the database connection handler."""
    print("Testing Database Connection Handler")
    print("=" * 50)
    
    # Test connectivity
    health = test_database_connectivity()
    print(f"Health Check: {json.dumps(health, indent=2)}")
    
    # Test with fallback
    db = get_database_connection(enable_fallback=True)
    connected = db.connect()
    
    print(f"\nConnection Status: {json.dumps(db.get_connection_status(), indent=2)}")
    
    if connected or db.is_fallback_mode:
        # Test a sample query
        try:
            results = db.execute_query("SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'")
            print(f"\nSample Query Results: {results}")
        except Exception as e:
            print(f"\nQuery Error: {e}")
    
    db.disconnect()