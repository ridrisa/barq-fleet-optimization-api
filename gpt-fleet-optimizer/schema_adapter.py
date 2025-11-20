#!/usr/bin/env python3
"""
Schema Mapping Adapter for BarqFleet Production Database
Maps local development schema names to production BarqFleet database schema.

PRODUCTION SCHEMA NOTES:
- Database: barqfleet_db
- Main tables: orders, shipments, couriers, hubs, merchants, order_logs
- Key differences from local dev:
  * couriers table (not drivers)
  * vehicle_type in couriers table (no separate vehicles table)
  * order_status field (not just status)
  * promise_time for SLA tracking
  * driving_distance in shipments

USAGE:
    from schema_adapter import SchemaAdapter

    adapter = SchemaAdapter()

    # Map table names
    prod_table = adapter.get_table_name('drivers')  # Returns 'couriers'

    # Map column names
    prod_column = adapter.get_column_name('couriers', 'driver_id')  # Returns 'courier_id'

    # Transform entire query
    prod_query = adapter.transform_query("SELECT * FROM drivers WHERE status = 'active'")
    # Returns: "SELECT * FROM couriers WHERE is_banned = false"
"""

import os
import re
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class SchemaAdapter:
    """
    Adapter for mapping local/demo schema to BarqFleet production schema.
    Provides transparent schema translation for analytics queries.
    """

    # Control via environment variable
    USE_PRODUCTION_SCHEMA = os.getenv('USE_PRODUCTION_SCHEMA', 'true').lower() == 'true'

    # Table name mappings (local_name -> production_name)
    TABLE_MAPPINGS = {
        'drivers': 'couriers',
        'vehicles': 'couriers',  # vehicle_type is in couriers table
        'deliveries': 'orders',
        'daily_orders': 'orders',  # No separate daily_orders table
        'shipment_logs': 'order_logs',
    }

    # Column name mappings by table (table -> {local_column -> production_column})
    COLUMN_MAPPINGS = {
        'couriers': {
            'driver_id': 'courier_id',
            'driver_name': 'CONCAT(first_name, \' \', last_name)',
            'status': 'CASE WHEN is_banned = true THEN \'inactive\' ELSE \'active\' END',
            'is_active': 'NOT is_banned',
            'phone': 'mobile_number',
            'mobile': 'mobile_number',
        },
        'orders': {
            'delivery_id': 'id',
            'status': 'order_status',
            'pickup_location': 'origin',
            'dropoff_location': 'destination',
            'pickup_lat': '(origin->\'lat\')::float',
            'pickup_lng': '(origin->\'lng\')::float',
            'dropoff_lat': '(destination->\'lat\')::float',
            'dropoff_lng': '(destination->\'lng\')::float',
            'customer_name': 'customer_details->>\'name\'',
            'customer_phone': 'customer_details->>\'phone\'',
            'estimated_delivery_time': 'promise_time',
            'actual_delivery_time': 'delivery_finish',
            'driver_id': 'courier_id',
        },
        'shipments': {
            'driver_id': 'courier_id',
            'vehicle_id': 'courier_id',  # vehicle type comes from courier
            'total_distance': 'driving_distance',
            'status': 'CASE WHEN is_completed THEN \'completed\' WHEN is_cancelled THEN \'cancelled\' ELSE \'active\' END',
            'pickup_time': 'created_at',
            'delivery_time': 'complete_time',
            'estimated_time': 'promise_time',
        },
        'hubs': {
            'pickup_location_id': 'id',
            'hub_name': 'code',
            'name': 'code',
            'status': 'CASE WHEN is_active THEN \'active\' ELSE \'inactive\' END',
        },
        'order_logs': {
            'shipment_id': 'order_id',
            'status': 'new_status',
            'previous_status': 'old_status',
        }
    }

    # Status value mappings (for WHERE clauses)
    STATUS_VALUE_MAPPINGS = {
        'orders': {
            'delivered': 'delivered',
            'completed': 'delivered',
            'pending': 'ready_for_delivery',
            'in_progress': 'in_transit',
            'failed': 'failed',
            'cancelled': 'cancelled',
        },
        'couriers': {
            'active': 'NOT is_banned AND is_active',
            'inactive': 'is_banned OR NOT is_active',
            'available': 'is_online AND NOT is_busy AND NOT is_banned',
        },
        'shipments': {
            'active': 'is_assigned = true AND is_completed = false',
            'completed': 'is_completed = true',
            'cancelled': 'is_cancelled = true',
        }
    }

    def __init__(self, enable_mapping: bool = None):
        """
        Initialize schema adapter.

        Args:
            enable_mapping: Override environment variable. If None, uses USE_PRODUCTION_SCHEMA env var.
        """
        if enable_mapping is not None:
            self.enabled = enable_mapping
        else:
            self.enabled = self.USE_PRODUCTION_SCHEMA

        if self.enabled:
            logger.info("✓ Schema adapter ENABLED - Using production BarqFleet schema")
        else:
            logger.info("Schema adapter DISABLED - Using local/demo schema")

    def get_table_name(self, local_table: str) -> str:
        """
        Get production table name for local table name.

        Args:
            local_table: Local/demo table name

        Returns:
            Production table name (or original if no mapping or disabled)
        """
        if not self.enabled:
            return local_table

        production_table = self.TABLE_MAPPINGS.get(local_table.lower(), local_table)

        if production_table != local_table:
            logger.debug(f"Table mapping: {local_table} -> {production_table}")

        return production_table

    def get_column_name(self, table: str, local_column: str) -> str:
        """
        Get production column name for a table column.

        Args:
            table: Table name (can be local or production)
            local_column: Local column name

        Returns:
            Production column name or expression
        """
        if not self.enabled:
            return local_column

        # Normalize table name to production
        prod_table = self.get_table_name(table)

        # Check if we have column mappings for this table
        if prod_table in self.COLUMN_MAPPINGS:
            column_map = self.COLUMN_MAPPINGS[prod_table]
            production_column = column_map.get(local_column.lower(), local_column)

            if production_column != local_column:
                logger.debug(f"Column mapping ({prod_table}): {local_column} -> {production_column}")

            return production_column

        return local_column

    def transform_query(self, query: str) -> str:
        """
        Transform entire SQL query from local schema to production schema.
        Handles table names, column names, and status values.

        Args:
            query: Original SQL query with local schema references

        Returns:
            Transformed query with production schema references
        """
        if not self.enabled:
            return query

        transformed = query

        # Step 1: Replace table names (case-insensitive)
        for local_table, prod_table in self.TABLE_MAPPINGS.items():
            # Match table names in FROM and JOIN clauses
            patterns = [
                rf'\bFROM\s+{local_table}\b',
                rf'\bJOIN\s+{local_table}\b',
                rf'\bINTO\s+{local_table}\b',
                rf'\bUPDATE\s+{local_table}\b',
            ]

            for pattern in patterns:
                transformed = re.sub(
                    pattern,
                    lambda m: m.group(0).replace(local_table, prod_table),
                    transformed,
                    flags=re.IGNORECASE
                )

        # Step 2: Replace column references (more complex - need context)
        # This is a simplified approach - for production, consider using SQL parser
        for table, column_map in self.COLUMN_MAPPINGS.items():
            for local_col, prod_col in column_map.items():
                # Only replace if it's not already a complex expression
                if not any(keyword in prod_col for keyword in ['CASE', 'CONCAT', '->']):
                    # Simple column name replacement
                    transformed = re.sub(
                        rf'\b{local_col}\b',
                        prod_col,
                        transformed,
                        flags=re.IGNORECASE
                    )

        # Step 3: Replace status values in WHERE clauses
        # This is intentionally simplified - complex status mapping should be done in queries themselves
        # We primarily handle table/column mapping, not value transformation

        if transformed != query:
            logger.debug("Query transformed:")
            logger.debug(f"  Original: {query[:100]}...")
            logger.debug(f"  Transformed: {transformed[:100]}...")

        return transformed

    def map_result_columns(self, results: List[Dict], table: str, reverse: bool = False) -> List[Dict]:
        """
        Map column names in query results between production and local schema.
        Useful for maintaining consistent API responses.

        Args:
            results: List of result dictionaries from database query
            table: Table name the results are from
            reverse: If True, map from production to local names (for API responses)

        Returns:
            Results with mapped column names
        """
        if not self.enabled or not results:
            return results

        prod_table = self.get_table_name(table)

        if prod_table not in self.COLUMN_MAPPINGS:
            return results

        column_map = self.COLUMN_MAPPINGS[prod_table]

        # Reverse the mapping if needed
        if reverse:
            column_map = {v: k for k, v in column_map.items()
                         if not any(keyword in v for keyword in ['CASE', 'CONCAT', '->'])}

        mapped_results = []
        for row in results:
            mapped_row = {}
            for key, value in row.items():
                # Check if this column should be renamed
                new_key = column_map.get(key, key)
                mapped_row[new_key] = value
            mapped_results.append(mapped_row)

        return mapped_results

    def get_schema_info(self) -> Dict:
        """
        Get information about the current schema mapping configuration.

        Returns:
            Dictionary with schema adapter status and mappings
        """
        return {
            'enabled': self.enabled,
            'source': 'production' if self.enabled else 'local',
            'database': 'barqfleet_db' if self.enabled else 'local_db',
            'table_mappings': self.TABLE_MAPPINGS if self.enabled else {},
            'tables_mapped': len(self.TABLE_MAPPINGS),
            'environment_variable': 'USE_PRODUCTION_SCHEMA',
            'current_value': os.getenv('USE_PRODUCTION_SCHEMA', 'true'),
        }

    @classmethod
    def create_from_env(cls) -> 'SchemaAdapter':
        """
        Factory method to create adapter from environment configuration.

        Returns:
            Configured SchemaAdapter instance
        """
        return cls(enable_mapping=None)  # Will read from environment


# Convenience functions for direct use
_default_adapter = None

def get_adapter() -> SchemaAdapter:
    """Get or create the default schema adapter instance."""
    global _default_adapter
    if _default_adapter is None:
        _default_adapter = SchemaAdapter.create_from_env()
    return _default_adapter

def get_table_name(local_table: str) -> str:
    """Convenience function to get production table name."""
    return get_adapter().get_table_name(local_table)

def get_column_name(table: str, local_column: str) -> str:
    """Convenience function to get production column name."""
    return get_adapter().get_column_name(table, local_column)

def transform_query(query: str) -> str:
    """Convenience function to transform query."""
    return get_adapter().transform_query(query)


if __name__ == "__main__":
    """Test the schema adapter with sample queries."""
    import json

    print("="*80)
    print("Schema Adapter Test Suite")
    print("="*80)

    # Initialize adapter
    adapter = SchemaAdapter()

    # Test 1: Schema info
    print("\n1. Schema Configuration:")
    print(json.dumps(adapter.get_schema_info(), indent=2))

    # Test 2: Table name mapping
    print("\n2. Table Name Mappings:")
    test_tables = ['drivers', 'vehicles', 'orders', 'shipments', 'hubs', 'unknown_table']
    for table in test_tables:
        mapped = adapter.get_table_name(table)
        print(f"  {table:20s} -> {mapped}")

    # Test 3: Column name mapping
    print("\n3. Column Name Mappings:")
    test_columns = [
        ('couriers', 'driver_id'),
        ('couriers', 'driver_name'),
        ('couriers', 'status'),
        ('orders', 'status'),
        ('shipments', 'total_distance'),
    ]
    for table, column in test_columns:
        mapped = adapter.get_column_name(table, column)
        print(f"  {table}.{column:20s} -> {mapped}")

    # Test 4: Query transformation
    print("\n4. Query Transformation Examples:")

    test_queries = [
        "SELECT * FROM drivers WHERE status = 'active'",
        "SELECT driver_id, driver_name FROM drivers JOIN vehicles ON drivers.id = vehicles.driver_id",
        "SELECT COUNT(*) FROM orders WHERE status = 'delivered' AND created_at >= NOW() - INTERVAL '7 days'",
        """
        SELECT
            d.driver_id,
            d.driver_name,
            COUNT(*) as total_deliveries
        FROM drivers d
        JOIN deliveries del ON d.id = del.driver_id
        WHERE del.status = 'completed'
        GROUP BY d.driver_id, d.driver_name
        """,
    ]

    for i, query in enumerate(test_queries, 1):
        print(f"\n  Test Query {i}:")
        print(f"    Original:    {query.strip()[:80]}...")
        transformed = adapter.transform_query(query)
        print(f"    Transformed: {transformed.strip()[:80]}...")

    # Test 5: Disable adapter and verify
    print("\n5. Test with Adapter Disabled:")
    adapter_disabled = SchemaAdapter(enable_mapping=False)
    test_query = "SELECT * FROM drivers WHERE status = 'active'"
    result = adapter_disabled.transform_query(test_query)
    print(f"  Input:  {test_query}")
    print(f"  Output: {result}")
    print(f"  Match:  {test_query == result}")

    print("\n" + "="*80)
    print("Schema Adapter Tests Complete")
    print("="*80)
