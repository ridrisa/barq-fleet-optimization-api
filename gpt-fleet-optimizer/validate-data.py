#!/usr/bin/env python3
"""
BarqFleet Production Database Validation Script

This script validates data quality and completeness in the BarqFleet production database.
It checks record counts, data quality metrics, and provides sample data verification.

Database: barqfleet_db (Production Read Replica)
Host: barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import json
from typing import Dict, List, Any
import sys

# Database configuration
DB_CONFIG = {
    'host': 'barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com',
    'database': 'barqfleet_db',
    'user': 'ventgres',
    'password': 'Jk56tt4HkzePFfa3ht',
    'port': 5432
}

class DatabaseValidator:
    """Validates BarqFleet production database data quality and completeness."""

    def __init__(self):
        self.conn = None
        self.cursor = None
        self.validation_results = {
            'timestamp': datetime.now().isoformat(),
            'database': DB_CONFIG['database'],
            'host': DB_CONFIG['host'],
            'tables': {},
            'warnings': [],
            'errors': []
        }

    def connect(self):
        """Establish database connection."""
        try:
            print(f"Connecting to {DB_CONFIG['host']}...")
            self.conn = psycopg2.connect(**DB_CONFIG)
            self.cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            print("✓ Database connection established\n")
            return True
        except Exception as e:
            error_msg = f"Failed to connect to database: {str(e)}"
            print(f"✗ {error_msg}")
            self.validation_results['errors'].append(error_msg)
            return False

    def disconnect(self):
        """Close database connection."""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
            print("\n✓ Database connection closed")

    def execute_query(self, query: str, description: str = "") -> List[Dict]:
        """Execute a query and return results."""
        try:
            self.cursor.execute(query)
            results = self.cursor.fetchall()
            return results
        except Exception as e:
            error_msg = f"Query failed ({description}): {str(e)}"
            print(f"  ✗ {error_msg}")
            self.validation_results['errors'].append(error_msg)
            # Rollback the transaction to continue
            self.conn.rollback()
            return []

    def validate_orders_table(self):
        """Validate orders table data quality."""
        print("=" * 80)
        print("VALIDATING ORDERS TABLE")
        print("=" * 80)

        table_results = {
            'total_count': 0,
            'expected_min_count': 2_800_000,
            'with_hub_id': 0,
            'with_shipment_id': 0,
            'last_30_days': 0,
            'with_delivery_times': 0,
            'status_distribution': {},
            'sample_records': [],
            'data_quality_score': 0
        }

        # Total count
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM orders",
            "Total orders count"
        )
        if result:
            table_results['total_count'] = result[0]['count']
            print(f"Total orders: {table_results['total_count']:,}")

            if table_results['total_count'] < table_results['expected_min_count']:
                warning = f"Orders count ({table_results['total_count']:,}) is below expected minimum ({table_results['expected_min_count']:,})"
                self.validation_results['warnings'].append(warning)
                print(f"  ⚠ {warning}")
            else:
                print(f"  ✓ Meets minimum expected count")

        # Records with hub_id
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM orders WHERE hub_id IS NOT NULL",
            "Orders with hub_id"
        )
        if result:
            table_results['with_hub_id'] = result[0]['count']
            percentage = (table_results['with_hub_id'] / table_results['total_count'] * 100) if table_results['total_count'] > 0 else 0
            print(f"Orders with hub_id: {table_results['with_hub_id']:,} ({percentage:.2f}%)")

            if percentage < 80:
                warning = f"Only {percentage:.2f}% of orders have hub_id"
                self.validation_results['warnings'].append(warning)
                print(f"  ⚠ {warning}")

        # Records with shipment_id
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM orders WHERE shipment_id IS NOT NULL",
            "Orders with shipment_id"
        )
        if result:
            table_results['with_shipment_id'] = result[0]['count']
            percentage = (table_results['with_shipment_id'] / table_results['total_count'] * 100) if table_results['total_count'] > 0 else 0
            print(f"Orders with shipment_id: {table_results['with_shipment_id']:,} ({percentage:.2f}%)")

            if percentage < 30:
                warning = f"Only {percentage:.2f}% of orders have shipment_id"
                self.validation_results['warnings'].append(warning)
                print(f"  ⚠ {warning}")

        # Records in last 30 days
        thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        result = self.execute_query(
            f"SELECT COUNT(*) as count FROM orders WHERE created_at >= '{thirty_days_ago}'",
            "Orders in last 30 days"
        )
        if result:
            table_results['last_30_days'] = result[0]['count']
            print(f"Orders in last 30 days: {table_results['last_30_days']:,}")

        # Records with delivery times
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM orders WHERE delivery_start IS NOT NULL AND delivery_finish IS NOT NULL",
            "Orders with delivery times"
        )
        if result:
            table_results['with_delivery_times'] = result[0]['count']
            percentage = (table_results['with_delivery_times'] / table_results['total_count'] * 100) if table_results['total_count'] > 0 else 0
            print(f"Orders with delivery times: {table_results['with_delivery_times']:,} ({percentage:.2f}%)")

        # Order status distribution
        result = self.execute_query(
            "SELECT order_status, COUNT(*) as count FROM orders WHERE order_status IS NOT NULL GROUP BY order_status ORDER BY count DESC LIMIT 10",
            "Order status distribution"
        )
        if result:
            print("\nOrder Status Distribution:")
            for row in result:
                status = row['order_status']
                count = row['count']
                percentage = (count / table_results['total_count'] * 100) if table_results['total_count'] > 0 else 0
                table_results['status_distribution'][status] = {
                    'count': count,
                    'percentage': percentage
                }
                print(f"  {status}: {count:,} ({percentage:.2f}%)")

        # Sample records
        result = self.execute_query(
            """SELECT id, hub_id, shipment_id, order_status, created_at, delivery_start, delivery_finish
               FROM orders
               WHERE hub_id IS NOT NULL AND shipment_id IS NOT NULL
               ORDER BY created_at DESC
               LIMIT 3""",
            "Sample orders"
        )
        if result:
            print("\nSample Records (3 most recent with hub_id and shipment_id):")
            for idx, row in enumerate(result, 1):
                sample = dict(row)
                table_results['sample_records'].append(sample)
                print(f"\n  Sample {idx}:")
                print(f"    ID: {sample.get('id')}")
                print(f"    Hub ID: {sample.get('hub_id')}")
                print(f"    Shipment ID: {sample.get('shipment_id')}")
                print(f"    Status: {sample.get('order_status')}")
                created_at = sample.get('created_at')
                if created_at:
                    if isinstance(created_at, (int, float)):
                        print(f"    Created: {datetime.fromtimestamp(created_at).strftime('%Y-%m-%d %H:%M:%S')}")
                    else:
                        print(f"    Created: {created_at}")
                else:
                    print(f"    Created: N/A")
                print(f"    Delivery Start: {sample.get('delivery_start')}")
                print(f"    Delivery Finish: {sample.get('delivery_finish')}")

        # Calculate data quality score
        quality_checks = [
            table_results['total_count'] >= table_results['expected_min_count'],
            (table_results['with_hub_id'] / table_results['total_count'] * 100) >= 80 if table_results['total_count'] > 0 else False,
            (table_results['with_shipment_id'] / table_results['total_count'] * 100) >= 30 if table_results['total_count'] > 0 else False,
            table_results['last_30_days'] > 0,
            len(table_results['status_distribution']) > 0
        ]
        table_results['data_quality_score'] = sum(quality_checks) / len(quality_checks) * 100

        print(f"\nData Quality Score: {table_results['data_quality_score']:.1f}%")

        self.validation_results['tables']['orders'] = table_results

    def validate_shipments_table(self):
        """Validate shipments table data quality."""
        print("\n" + "=" * 80)
        print("VALIDATING SHIPMENTS TABLE")
        print("=" * 80)

        table_results = {
            'total_count': 0,
            'expected_min_count': 1_100_000,
            'with_courier_id': 0,
            'with_promise_time': 0,
            'completed': 0,
            'with_driving_distance': 0,
            'sample_records': [],
            'data_quality_score': 0
        }

        # Total count
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM shipments",
            "Total shipments count"
        )
        if result:
            table_results['total_count'] = result[0]['count']
            print(f"Total shipments: {table_results['total_count']:,}")

            if table_results['total_count'] < table_results['expected_min_count']:
                warning = f"Shipments count ({table_results['total_count']:,}) is below expected minimum ({table_results['expected_min_count']:,})"
                self.validation_results['warnings'].append(warning)
                print(f"  ⚠ {warning}")
            else:
                print(f"  ✓ Meets minimum expected count")

        # Records with courier_id
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM shipments WHERE courier_id IS NOT NULL",
            "Shipments with courier_id"
        )
        if result:
            table_results['with_courier_id'] = result[0]['count']
            percentage = (table_results['with_courier_id'] / table_results['total_count'] * 100) if table_results['total_count'] > 0 else 0
            print(f"Shipments with courier_id: {table_results['with_courier_id']:,} ({percentage:.2f}%)")

            if percentage < 90:
                warning = f"Only {percentage:.2f}% of shipments have courier_id"
                self.validation_results['warnings'].append(warning)
                print(f"  ⚠ {warning}")

        # Records with promise_time
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM shipments WHERE promise_time IS NOT NULL",
            "Shipments with promise_time"
        )
        if result:
            table_results['with_promise_time'] = result[0]['count']
            percentage = (table_results['with_promise_time'] / table_results['total_count'] * 100) if table_results['total_count'] > 0 else 0
            print(f"Shipments with promise_time: {table_results['with_promise_time']:,} ({percentage:.2f}%)")

            if percentage < 80:
                warning = f"Only {percentage:.2f}% of shipments have promise_time"
                self.validation_results['warnings'].append(warning)
                print(f"  ⚠ {warning}")

        # Completed shipments
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM shipments WHERE is_completed = true",
            "Completed shipments"
        )
        if result:
            table_results['completed'] = result[0]['count']
            percentage = (table_results['completed'] / table_results['total_count'] * 100) if table_results['total_count'] > 0 else 0
            print(f"Completed shipments: {table_results['completed']:,} ({percentage:.2f}%)")

        # Records with driving_distance > 0
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM shipments WHERE driving_distance > 0",
            "Shipments with driving distance"
        )
        if result:
            table_results['with_driving_distance'] = result[0]['count']
            percentage = (table_results['with_driving_distance'] / table_results['total_count'] * 100) if table_results['total_count'] > 0 else 0
            print(f"Shipments with driving_distance > 0: {table_results['with_driving_distance']:,} ({percentage:.2f}%)")

            if percentage < 50:
                warning = f"Only {percentage:.2f}% of shipments have driving_distance > 0"
                self.validation_results['warnings'].append(warning)
                print(f"  ⚠ {warning}")

        # Sample records with promise_time verification
        result = self.execute_query(
            """SELECT id, courier_id, promise_time, is_completed, driving_distance, created_at
               FROM shipments
               WHERE promise_time IS NOT NULL AND courier_id IS NOT NULL
               ORDER BY created_at DESC
               LIMIT 5""",
            "Sample shipments"
        )
        if result:
            print("\nSample Records (5 most recent with promise_time and courier_id):")
            for idx, row in enumerate(result, 1):
                sample = dict(row)
                table_results['sample_records'].append(sample)
                print(f"\n  Sample {idx}:")
                print(f"    ID: {sample.get('id')}")
                print(f"    Courier ID: {sample.get('courier_id')}")
                promise_time = sample.get('promise_time')
                if promise_time:
                    if isinstance(promise_time, (int, float)):
                        print(f"    Promise Time: {promise_time} (Unix timestamp: {datetime.fromtimestamp(promise_time).strftime('%Y-%m-%d %H:%M:%S')})")
                    else:
                        print(f"    Promise Time: {promise_time}")
                else:
                    print(f"    Promise Time: N/A")
                print(f"    Is Completed: {sample.get('is_completed')}")
                print(f"    Driving Distance: {sample.get('driving_distance')}")
                created_at = sample.get('created_at')
                if created_at:
                    if isinstance(created_at, (int, float)):
                        print(f"    Created: {datetime.fromtimestamp(created_at).strftime('%Y-%m-%d %H:%M:%S')}")
                    else:
                        print(f"    Created: {created_at}")
                else:
                    print(f"    Created: N/A")

        # Calculate data quality score
        quality_checks = [
            table_results['total_count'] >= table_results['expected_min_count'],
            (table_results['with_courier_id'] / table_results['total_count'] * 100) >= 90 if table_results['total_count'] > 0 else False,
            (table_results['with_promise_time'] / table_results['total_count'] * 100) >= 80 if table_results['total_count'] > 0 else False,
            (table_results['with_driving_distance'] / table_results['total_count'] * 100) >= 50 if table_results['total_count'] > 0 else False,
            table_results['completed'] > 0
        ]
        table_results['data_quality_score'] = sum(quality_checks) / len(quality_checks) * 100

        print(f"\nData Quality Score: {table_results['data_quality_score']:.1f}%")

        self.validation_results['tables']['shipments'] = table_results

    def validate_couriers_table(self):
        """Validate couriers table data quality."""
        print("\n" + "=" * 80)
        print("VALIDATING COURIERS TABLE")
        print("=" * 80)

        table_results = {
            'total_count': 0,
            'expected_min_count': 6_503,
            'with_vehicle_type': 0,
            'online_count': 0,
            'vehicle_type_distribution': {},
            'sample_records': [],
            'data_quality_score': 0
        }

        # Total count
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM couriers",
            "Total couriers count"
        )
        if result:
            table_results['total_count'] = result[0]['count']
            print(f"Total couriers: {table_results['total_count']:,}")

            if table_results['total_count'] < table_results['expected_min_count']:
                warning = f"Couriers count ({table_results['total_count']:,}) is below expected minimum ({table_results['expected_min_count']:,})"
                self.validation_results['warnings'].append(warning)
                print(f"  ⚠ {warning}")
            else:
                print(f"  ✓ Meets minimum expected count")

        # Records with vehicle_type
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM couriers WHERE vehicle_type IS NOT NULL",
            "Couriers with vehicle_type"
        )
        if result:
            table_results['with_vehicle_type'] = result[0]['count']
            percentage = (table_results['with_vehicle_type'] / table_results['total_count'] * 100) if table_results['total_count'] > 0 else 0
            print(f"Couriers with vehicle_type: {table_results['with_vehicle_type']:,} ({percentage:.2f}%)")

            if percentage < 95:
                warning = f"Only {percentage:.2f}% of couriers have vehicle_type"
                self.validation_results['warnings'].append(warning)
                print(f"  ⚠ {warning}")

        # Online couriers
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM couriers WHERE is_online = true",
            "Online couriers"
        )
        if result:
            table_results['online_count'] = result[0]['count']
            percentage = (table_results['online_count'] / table_results['total_count'] * 100) if table_results['total_count'] > 0 else 0
            print(f"Online couriers: {table_results['online_count']:,} ({percentage:.2f}%)")

        # Vehicle type distribution
        result = self.execute_query(
            "SELECT vehicle_type, COUNT(*) as count FROM couriers WHERE vehicle_type IS NOT NULL GROUP BY vehicle_type ORDER BY count DESC",
            "Vehicle type distribution"
        )
        if result:
            print("\nVehicle Type Distribution:")
            for row in result:
                vehicle_type = row['vehicle_type']
                count = row['count']
                percentage = (count / table_results['total_count'] * 100) if table_results['total_count'] > 0 else 0
                table_results['vehicle_type_distribution'][vehicle_type] = {
                    'count': count,
                    'percentage': percentage
                }
                print(f"  {vehicle_type}: {count:,} ({percentage:.2f}%)")

        # Sample records
        result = self.execute_query(
            """SELECT id, vehicle_type, is_online, created_at
               FROM couriers
               WHERE vehicle_type IS NOT NULL
               ORDER BY created_at DESC
               LIMIT 5""",
            "Sample couriers"
        )
        if result:
            print("\nSample Records (5 most recent):")
            for idx, row in enumerate(result, 1):
                sample = dict(row)
                table_results['sample_records'].append(sample)
                print(f"\n  Sample {idx}:")
                print(f"    ID: {sample.get('id')}")
                print(f"    Vehicle Type: {sample.get('vehicle_type')}")
                print(f"    Is Online: {sample.get('is_online')}")
                created_at = sample.get('created_at')
                if created_at:
                    if isinstance(created_at, (int, float)):
                        print(f"    Created: {datetime.fromtimestamp(created_at).strftime('%Y-%m-%d %H:%M:%S')}")
                    else:
                        print(f"    Created: {created_at}")
                else:
                    print(f"    Created: N/A")

        # Calculate data quality score
        quality_checks = [
            table_results['total_count'] >= table_results['expected_min_count'],
            (table_results['with_vehicle_type'] / table_results['total_count'] * 100) >= 95 if table_results['total_count'] > 0 else False,
            len(table_results['vehicle_type_distribution']) > 0,
            table_results['online_count'] > 0
        ]
        table_results['data_quality_score'] = sum(quality_checks) / len(quality_checks) * 100

        print(f"\nData Quality Score: {table_results['data_quality_score']:.1f}%")

        self.validation_results['tables']['couriers'] = table_results

    def validate_hubs_table(self):
        """Validate hubs table data quality."""
        print("\n" + "=" * 80)
        print("VALIDATING HUBS TABLE")
        print("=" * 80)

        table_results = {
            'total_count': 0,
            'expected_min_count': 22_816,
            'with_complete_data': 0,
            'sample_records': [],
            'data_quality_score': 0
        }

        # Total count
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM hubs",
            "Total hubs count"
        )
        if result:
            table_results['total_count'] = result[0]['count']
            print(f"Total hubs: {table_results['total_count']:,}")

            if table_results['total_count'] < table_results['expected_min_count']:
                warning = f"Hubs count ({table_results['total_count']:,}) is below expected minimum ({table_results['expected_min_count']:,})"
                self.validation_results['warnings'].append(warning)
                print(f"  ⚠ {warning}")
            else:
                print(f"  ✓ Meets minimum expected count")

        # Records with complete data
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM hubs WHERE code IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL",
            "Hubs with complete data"
        )
        if result:
            table_results['with_complete_data'] = result[0]['count']
            percentage = (table_results['with_complete_data'] / table_results['total_count'] * 100) if table_results['total_count'] > 0 else 0
            print(f"Hubs with complete data (code, lat, lon): {table_results['with_complete_data']:,} ({percentage:.2f}%)")

            if percentage < 95:
                warning = f"Only {percentage:.2f}% of hubs have complete data"
                self.validation_results['warnings'].append(warning)
                print(f"  ⚠ {warning}")

        # Sample records
        result = self.execute_query(
            """SELECT id, code, latitude, longitude, created_at
               FROM hubs
               WHERE code IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
               ORDER BY created_at DESC
               LIMIT 5""",
            "Sample hubs"
        )
        if result:
            print("\nSample Records (5 most recent with complete data):")
            for idx, row in enumerate(result, 1):
                sample = dict(row)
                table_results['sample_records'].append(sample)
                print(f"\n  Sample {idx}:")
                print(f"    ID: {sample.get('id')}")
                print(f"    Code: {sample.get('code')}")
                print(f"    Latitude: {sample.get('latitude')}")
                print(f"    Longitude: {sample.get('longitude')}")
                created_at = sample.get('created_at')
                if created_at:
                    if isinstance(created_at, (int, float)):
                        print(f"    Created: {datetime.fromtimestamp(created_at).strftime('%Y-%m-%d %H:%M:%S')}")
                    else:
                        print(f"    Created: {created_at}")
                else:
                    print(f"    Created: N/A")

        # Calculate data quality score
        quality_checks = [
            table_results['total_count'] >= table_results['expected_min_count'],
            (table_results['with_complete_data'] / table_results['total_count'] * 100) >= 95 if table_results['total_count'] > 0 else False
        ]
        table_results['data_quality_score'] = sum(quality_checks) / len(quality_checks) * 100

        print(f"\nData Quality Score: {table_results['data_quality_score']:.1f}%")

        self.validation_results['tables']['hubs'] = table_results

    def generate_summary_report(self):
        """Generate overall validation summary."""
        print("\n" + "=" * 80)
        print("VALIDATION SUMMARY")
        print("=" * 80)

        total_warnings = len(self.validation_results['warnings'])
        total_errors = len(self.validation_results['errors'])

        print(f"\nValidation Timestamp: {self.validation_results['timestamp']}")
        print(f"Database: {self.validation_results['database']}")
        print(f"Host: {self.validation_results['host']}")

        print(f"\n{'Table':<15} {'Records':<15} {'Expected Min':<15} {'Quality Score':<15} {'Status'}")
        print("-" * 80)

        overall_quality = 0
        table_count = 0

        for table_name, table_data in self.validation_results['tables'].items():
            total = table_data.get('total_count', 0)
            expected = table_data.get('expected_min_count', 0)
            quality = table_data.get('data_quality_score', 0)
            status = "✓ PASS" if total >= expected and quality >= 70 else "⚠ WARNING"

            print(f"{table_name:<15} {total:>12,}   {expected:>12,}   {quality:>12.1f}%   {status}")

            overall_quality += quality
            table_count += 1

        if table_count > 0:
            overall_quality /= table_count

        print("-" * 80)
        print(f"Overall Data Quality Score: {overall_quality:.1f}%")
        print(f"\nWarnings: {total_warnings}")
        print(f"Errors: {total_errors}")

        if total_errors > 0:
            print("\n⚠ ERRORS FOUND:")
            for error in self.validation_results['errors']:
                print(f"  - {error}")

        if total_warnings > 0:
            print("\n⚠ WARNINGS:")
            for warning in self.validation_results['warnings']:
                print(f"  - {warning}")

        if total_errors == 0 and total_warnings == 0:
            print("\n✓ All validation checks passed successfully!")

        # Save detailed report to JSON
        report_filename = f"validation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_filename, 'w') as f:
            json.dump(self.validation_results, f, indent=2, default=str)

        print(f"\n✓ Detailed report saved to: {report_filename}")

    def run_validation(self):
        """Execute complete validation process."""
        print("\n" + "=" * 80)
        print("BARQFLEET PRODUCTION DATABASE VALIDATION")
        print("=" * 80)
        print()

        if not self.connect():
            return False

        try:
            self.validate_orders_table()
            self.validate_shipments_table()
            self.validate_couriers_table()
            self.validate_hubs_table()
            self.generate_summary_report()
            return True
        except Exception as e:
            error_msg = f"Validation failed with unexpected error: {str(e)}"
            print(f"\n✗ {error_msg}")
            self.validation_results['errors'].append(error_msg)
            return False
        finally:
            self.disconnect()


def main():
    """Main execution function."""
    validator = DatabaseValidator()
    success = validator.run_validation()

    # Exit with appropriate status code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
