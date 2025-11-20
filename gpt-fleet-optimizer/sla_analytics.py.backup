#!/usr/bin/env python3
"""
SLA Analytics - Fleet Optimizer Module
Real-time SLA monitoring and analytics for instant delivery operations.

Focuses on:
- BARQ (1-hour instant delivery) SLA compliance
- BULLET (2-4 hour batch) SLA compliance
- Real-time breach detection and alerts
- SLA trend analysis and predictions

Usage:
    python sla_analytics.py --analysis_type realtime
    python sla_analytics.py --analysis_type compliance --date_range 7
    python sla_analytics.py --analysis_type breach_risk --hub_id 5
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
import numpy as np


class SLAAnalytics:
    """Analyzes SLA compliance and instant delivery performance."""

    # SLA Targets (in minutes)
    SLA_TARGETS = {
        'BARQ': 60,      # 1 hour for instant delivery
        'BULLET': 240,   # 4 hours for batch delivery
    }

    # Compliance thresholds
    EXCELLENT_THRESHOLD = 95.0  # % compliance
    GOOD_THRESHOLD = 90.0
    WARNING_THRESHOLD = 85.0

    def __init__(self, db_config: Dict[str, str] = None):
        """
        Initialize SLA Analytics.

        Args:
            db_config: Database configuration. If None, reads from environment.
        """
        if db_config is None:
            db_config = {
                'host': os.getenv('DB_HOST', 'localhost'),
                'port': int(os.getenv('DB_PORT', 5432)),
                'database': os.getenv('DB_NAME', 'barq_logistics'),
                'user': os.getenv('DB_USER', 'postgres'),
                'password': os.getenv('DB_PASSWORD', 'postgres')
            }

        self.db_config = db_config
        self.conn = None

    def connect(self):
        """Establish database connection."""
        try:
            self.conn = psycopg2.connect(**self.db_config)
            print("✓ Connected to database successfully")
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
            sys.exit(1)

    def disconnect(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            print("✓ Database connection closed")

    def get_realtime_sla_status(self) -> Dict:
        """
        Get real-time SLA status for active deliveries.

        Returns:
            Dictionary with current SLA status and at-risk deliveries
        """
        print(f"\n⚡ Getting real-time SLA status...")

        query = """
        WITH active_deliveries AS (
            SELECT
                s.id,
                s.order_number as order_number,
                s.service_type,
                s.created_at,
                s.sla_deadline as sla_deadline,
                s.status,
                s.driver_id,
                s.hub_id,
                h.code as hub_name,
                EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 60 as elapsed_minutes,
                EXTRACT(EPOCH FROM (s.sla_deadline - NOW())) / 60 as remaining_minutes,
                CASE
                    WHEN s.service_type = 'BARQ' THEN 60
                    WHEN s.service_type = 'BULLET' THEN 240
                    ELSE 60
                END as sla_target_minutes
            FROM orders s
            LEFT JOIN hubs h ON s.hub_id = h.id
            WHERE s.status IN ('pending', 'assigned', 'picked_up', 'in_transit')
            AND s.created_at >= NOW() - INTERVAL '24 hours'
        )
        SELECT
            service_type,
            COUNT(*) as active_count,
            AVG(elapsed_minutes) as avg_elapsed_minutes,
            COUNT(CASE WHEN remaining_minutes < 15 THEN 1 END) as at_risk_count,
            COUNT(CASE WHEN remaining_minutes < 0 THEN 1 END) as breached_count,
            MIN(remaining_minutes) as min_remaining_minutes,
            MAX(elapsed_minutes) as max_elapsed_minutes
        FROM active_deliveries
        GROUP BY service_type
        ORDER BY service_type
        """

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query)
            results = cursor.fetchall()

            # Get at-risk deliveries details
            at_risk_query = """
            SELECT
                s.id,
                s.order_number,
                s.service_type,
                s.status,
                s.driver_id,
                s.hub_id,
                h.code as hub_name,
                EXTRACT(EPOCH FROM (s.sla_deadline - NOW())) / 60 as remaining_minutes,
                EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 60 as elapsed_minutes
            FROM orders s
            LEFT JOIN hubs h ON s.hub_id = h.id
            WHERE s.status IN ('pending', 'assigned', 'picked_up', 'in_transit')
            AND s.sla_deadline - NOW() < INTERVAL '15 minutes'
            ORDER BY remaining_minutes ASC
            LIMIT 20
            """

            cursor.execute(at_risk_query)
            at_risk_deliveries = cursor.fetchall()
            cursor.close()

            if not results:
                print("✓ No active deliveries at this time")
                return {
                    'status': 'idle',
                    'active_deliveries': 0,
                    'at_risk': 0,
                    'breached': 0,
                    'timestamp': datetime.now().isoformat()
                }

            # Process results
            summary = {
                'status': 'active',
                'timestamp': datetime.now().isoformat(),
                'by_service_type': {},
                'at_risk_deliveries': [],
                'overall': {
                    'total_active': 0,
                    'total_at_risk': 0,
                    'total_breached': 0
                }
            }

            for row in results:
                service_type = row['service_type']
                summary['by_service_type'][service_type] = {
                    'active_count': int(row['active_count']),
                    'avg_elapsed_minutes': float(row['avg_elapsed_minutes']),
                    'at_risk_count': int(row['at_risk_count']),
                    'breached_count': int(row['breached_count']),
                    'min_remaining_minutes': float(row['min_remaining_minutes']) if row['min_remaining_minutes'] else 0,
                    'max_elapsed_minutes': float(row['max_elapsed_minutes'])
                }

                summary['overall']['total_active'] += int(row['active_count'])
                summary['overall']['total_at_risk'] += int(row['at_risk_count'])
                summary['overall']['total_breached'] += int(row['breached_count'])

            # Add at-risk delivery details
            for delivery in at_risk_deliveries:
                summary['at_risk_deliveries'].append({
                    'id': delivery['id'],
                    'order_number': delivery['order_number'],
                    'service_type': delivery['service_type'],
                    'status': delivery['status'],
                    'driver_id': delivery['driver_id'],
                    'hub_name': delivery.get('hub_name', 'Unknown'),
                    'remaining_minutes': float(delivery['remaining_minutes']),
                    'elapsed_minutes': float(delivery['elapsed_minutes']),
                    'urgency': 'critical' if delivery['remaining_minutes'] < 5 else 'high' if delivery['remaining_minutes'] < 10 else 'medium'
                })

            # Determine overall status
            if summary['overall']['total_breached'] > 0:
                summary['status'] = 'critical'
            elif summary['overall']['total_at_risk'] > 5:
                summary['status'] = 'warning'
            else:
                summary['status'] = 'healthy'

            print(f"✓ Status: {summary['status'].upper()}")
            print(f"  Active: {summary['overall']['total_active']}, At Risk: {summary['overall']['total_at_risk']}, Breached: {summary['overall']['total_breached']}")

            return summary

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Real-time status check failed: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    def analyze_sla_compliance(self, date_range: int = 7, service_type: str = None) -> Dict:
        """
        Analyze historical SLA compliance.

        Args:
            date_range: Number of days to analyze
            service_type: Filter by service type (BARQ, BULLET)

        Returns:
            Dictionary with compliance metrics and trends
        """
        print(f"\n📊 Analyzing SLA compliance (last {date_range} days)...")

        end_date = datetime.now()
        start_date = end_date - timedelta(days=date_range)

        query = """
        WITH delivery_performance AS (
            SELECT
                s.id,
                s.order_number,
                s.service_type,
                s.created_at,
                s.sla_deadline,
                s.delivered_at,
                s.hub_id,
                h.code as hub_name,
                EXTRACT(EPOCH FROM (s.delivered_at - s.created_at)) / 60 as actual_duration_minutes,
                CASE
                    WHEN s.service_type = 'BARQ' THEN 60
                    WHEN s.service_type = 'BULLET' THEN 240
                    ELSE 60
                END as sla_target_minutes,
                CASE
                    WHEN s.delivered_at <= s.sla_deadline THEN 1
                    ELSE 0
                END as sla_met,
                EXTRACT(EPOCH FROM (s.delivered_at - s.sla_deadline)) / 60 as breach_minutes
            FROM orders s
            LEFT JOIN hubs h ON s.hub_id = h.id
            WHERE s.delivered_at IS NOT NULL
            AND s.delivered_at >= %s
            AND s.delivered_at <= %s
            {}
        )
        SELECT
            service_type,
            COUNT(*) as total_deliveries,
            SUM(sla_met) as deliveries_on_time,
            COUNT(*) - SUM(sla_met) as deliveries_breached,
            (SUM(sla_met)::float / COUNT(*) * 100) as compliance_rate,
            AVG(actual_duration_minutes) as avg_duration_minutes,
            AVG(sla_target_minutes) as sla_target,
            AVG(CASE WHEN sla_met = 0 THEN breach_minutes ELSE 0 END) as avg_breach_minutes,
            MAX(breach_minutes) as max_breach_minutes,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY actual_duration_minutes) as median_duration,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY actual_duration_minutes) as p95_duration
        FROM delivery_performance
        GROUP BY service_type
        ORDER BY service_type
        """.format("AND s.service_type = %s" if service_type else "")

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            params = [start_date, end_date]
            if service_type:
                params.append(service_type)

            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()

            if not results:
                print("⚠ No delivery data found for the specified period")
                return {"error": "No data available"}

            # Process results
            compliance_data = {
                'analysis_period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'days': date_range
                },
                'by_service_type': {},
                'overall': {
                    'total_deliveries': 0,
                    'deliveries_on_time': 0,
                    'deliveries_breached': 0,
                    'compliance_rate': 0.0
                }
            }

            for row in results:
                st = row['service_type']
                compliance_data['by_service_type'][st] = {
                    'total_deliveries': int(row['total_deliveries']),
                    'deliveries_on_time': int(row['deliveries_on_time']),
                    'deliveries_breached': int(row['deliveries_breached']),
                    'compliance_rate': float(row['compliance_rate']),
                    'avg_duration_minutes': float(row['avg_duration_minutes']),
                    'sla_target_minutes': float(row['sla_target']),
                    'avg_breach_minutes': float(row['avg_breach_minutes']) if row['avg_breach_minutes'] else 0,
                    'max_breach_minutes': float(row['max_breach_minutes']) if row['max_breach_minutes'] else 0,
                    'median_duration': float(row['median_duration']),
                    'p95_duration': float(row['p95_duration']),
                    'status': self._get_compliance_status(float(row['compliance_rate']))
                }

                # Update overall
                compliance_data['overall']['total_deliveries'] += int(row['total_deliveries'])
                compliance_data['overall']['deliveries_on_time'] += int(row['deliveries_on_time'])
                compliance_data['overall']['deliveries_breached'] += int(row['deliveries_breached'])

            # Calculate overall compliance rate
            if compliance_data['overall']['total_deliveries'] > 0:
                compliance_data['overall']['compliance_rate'] = (
                    compliance_data['overall']['deliveries_on_time'] /
                    compliance_data['overall']['total_deliveries'] * 100
                )

            # Add recommendations
            compliance_data['recommendations'] = self._generate_compliance_recommendations(compliance_data)

            print(f"✓ Analyzed {compliance_data['overall']['total_deliveries']} deliveries")
            print(f"  Overall compliance: {compliance_data['overall']['compliance_rate']:.1f}%")

            return compliance_data

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ SLA compliance analysis failed: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    def identify_breach_risks(self, hub_id: int = None) -> Dict:
        """
        Identify patterns and factors leading to SLA breaches.

        Args:
            hub_id: Optional hub to focus analysis on

        Returns:
            Dictionary with breach risk factors and predictions
        """
        print(f"\n⚠️  Identifying SLA breach risks...")

        query = """
        WITH recent_breaches AS (
            SELECT
                s.id,
                s.service_type,
                s.hub_id,
                h.code as hub_name,
                s.driver_id,
                s.created_at,
                EXTRACT(HOUR FROM s.created_at) as hour_of_day,
                EXTRACT(DOW FROM s.created_at) as day_of_week,
                EXTRACT(EPOCH FROM (s.delivered_at - s.sla_deadline)) / 60 as breach_minutes,
                s.status
            FROM orders s
            LEFT JOIN hubs h ON s.hub_id = h.id
            WHERE s.delivered_at > s.sla_deadline
            AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'
            {}
        )
        SELECT
            service_type,
            hub_name,
            hour_of_day,
            day_of_week,
            COUNT(*) as breach_count,
            AVG(breach_minutes) as avg_breach_minutes,
            MAX(breach_minutes) as max_breach_minutes,
            COUNT(DISTINCT driver_id) as drivers_involved
        FROM recent_breaches
        GROUP BY service_type, hub_name, hour_of_day, day_of_week
        HAVING COUNT(*) >= 3
        ORDER BY breach_count DESC, avg_breach_minutes DESC
        LIMIT 50
        """.format("AND s.hub_id = %s" if hub_id else "")

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            params = [hub_id] if hub_id else []
            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()

            if not results:
                print("✓ No significant breach patterns detected")
                return {
                    'status': 'healthy',
                    'risk_factors': [],
                    'recommendations': ['Continue current operations. SLA compliance is strong.']
                }

            # Analyze patterns
            risk_factors = []
            day_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

            for row in results:
                risk_factors.append({
                    'service_type': row['service_type'],
                    'hub_name': row['hub_name'],
                    'hour_of_day': f"{int(row['hour_of_day']):02d}:00",
                    'day_of_week': day_names[int(row['day_of_week'])],
                    'breach_count': int(row['breach_count']),
                    'avg_breach_minutes': float(row['avg_breach_minutes']),
                    'max_breach_minutes': float(row['max_breach_minutes']),
                    'drivers_involved': int(row['drivers_involved']),
                    'severity': 'high' if row['breach_count'] > 10 else 'medium'
                })

            # Generate recommendations
            recommendations = self._generate_breach_recommendations(risk_factors)

            print(f"✓ Identified {len(risk_factors)} breach risk patterns")

            return {
                'status': 'risks_identified',
                'risk_factors': risk_factors[:20],  # Top 20 risk factors
                'total_patterns': len(risk_factors),
                'recommendations': recommendations,
                'analysis_date': datetime.now().isoformat()
            }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Breach risk analysis failed: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    def get_sla_trend(self, days: int = 30) -> Dict:
        """
        Analyze SLA compliance trends over time.

        Args:
            days: Number of days for trend analysis

        Returns:
            Dictionary with daily compliance rates and trend direction
        """
        print(f"\n📈 Analyzing SLA trend (last {days} days)...")

        query = """
        WITH daily_compliance AS (
            SELECT
                DATE(delivered_at) as delivery_date,
                service_type,
                COUNT(*) as total_deliveries,
                SUM(CASE WHEN delivered_at <= sla_deadline THEN 1 ELSE 0 END) as on_time_deliveries,
                (SUM(CASE WHEN delivered_at <= sla_deadline THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as compliance_rate
            FROM orders
            WHERE delivered_at IS NOT NULL
            AND delivered_at >= CURRENT_DATE - INTERVAL '%s days'
            GROUP BY DATE(delivered_at), service_type
        )
        SELECT
            delivery_date,
            service_type,
            total_deliveries,
            on_time_deliveries,
            compliance_rate
        FROM daily_compliance
        ORDER BY delivery_date DESC, service_type
        """

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query, (days,))
            results = cursor.fetchall()
            cursor.close()

            if not results:
                return {"error": "No data available"}

            df = pd.DataFrame(results)

            # Calculate trend for each service type
            trends = {}
            for service_type in df['service_type'].unique():
                st_data = df[df['service_type'] == service_type].sort_values('delivery_date')

                if len(st_data) > 1:
                    # Simple linear trend
                    x = np.arange(len(st_data))
                    y = st_data['compliance_rate'].values
                    slope, intercept = np.polyfit(x, y, 1)

                    trends[service_type] = {
                        'daily_data': st_data.to_dict('records'),
                        'current_rate': float(st_data.iloc[-1]['compliance_rate']),
                        'previous_rate': float(st_data.iloc[0]['compliance_rate']),
                        'trend_slope': float(slope),
                        'trend_direction': 'improving' if slope > 0.1 else 'declining' if slope < -0.1 else 'stable',
                        'avg_rate': float(st_data['compliance_rate'].mean())
                    }

            print(f"✓ Trend analysis complete for {len(trends)} service types")

            return {
                'analysis_period_days': days,
                'trends_by_service_type': trends,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Trend analysis failed: {e}")
            return {"error": str(e)}

    def _get_compliance_status(self, compliance_rate: float) -> str:
        """Determine compliance status based on rate."""
        if compliance_rate >= self.EXCELLENT_THRESHOLD:
            return 'excellent'
        elif compliance_rate >= self.GOOD_THRESHOLD:
            return 'good'
        elif compliance_rate >= self.WARNING_THRESHOLD:
            return 'warning'
        else:
            return 'critical'

    def _generate_compliance_recommendations(self, data: Dict) -> List[str]:
        """Generate actionable recommendations based on compliance data."""
        recommendations = []

        for service_type, metrics in data['by_service_type'].items():
            rate = metrics['compliance_rate']
            target = self.SLA_TARGETS.get(service_type, 60)

            if rate < self.WARNING_THRESHOLD:
                recommendations.append(
                    f"🔴 CRITICAL: {service_type} compliance at {rate:.1f}% (target: {self.GOOD_THRESHOLD}%). "
                    f"Immediate action required. Average breach: {metrics['avg_breach_minutes']:.1f} minutes."
                )
            elif rate < self.GOOD_THRESHOLD:
                recommendations.append(
                    f"🟡 WARNING: {service_type} compliance at {rate:.1f}%. "
                    f"Review driver assignments and route optimization."
                )
            elif rate >= self.EXCELLENT_THRESHOLD:
                recommendations.append(
                    f"✅ EXCELLENT: {service_type} compliance at {rate:.1f}%. "
                    f"Maintain current operations."
                )

            # Check if actual duration is close to SLA limit
            if metrics['avg_duration_minutes'] > target * 0.8:
                recommendations.append(
                    f"⚠️ {service_type}: Average delivery time ({metrics['avg_duration_minutes']:.1f} min) "
                    f"approaching SLA limit ({target} min). Consider adding capacity."
                )

        return recommendations if recommendations else ["All service types performing well."]

    def _generate_breach_recommendations(self, risk_factors: List[Dict]) -> List[str]:
        """Generate recommendations based on breach risk patterns."""
        recommendations = []

        if not risk_factors:
            return ["No significant breach patterns detected. Continue monitoring."]

        # Group by hub
        hub_breaches = {}
        for factor in risk_factors:
            hub = factor['hub_name']
            hub_breaches[hub] = hub_breaches.get(hub, 0) + factor['breach_count']

        # Top problematic hubs
        sorted_hubs = sorted(hub_breaches.items(), key=lambda x: x[1], reverse=True)[:3]
        if sorted_hubs:
            for hub, count in sorted_hubs:
                recommendations.append(
                    f"🎯 Focus on {hub}: {count} breaches detected. "
                    f"Review capacity, driver availability, and route efficiency."
                )

        # Time-based patterns
        peak_hours = {}
        for factor in risk_factors:
            hour = factor['hour_of_day']
            peak_hours[hour] = peak_hours.get(hour, 0) + factor['breach_count']

        if peak_hours:
            worst_hour = max(peak_hours.items(), key=lambda x: x[1])
            recommendations.append(
                f"⏰ Peak breach time: {worst_hour[0]} ({worst_hour[1]} breaches). "
                f"Consider increasing driver availability during this period."
            )

        return recommendations


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='SLA Analytics for Instant Delivery')
    parser.add_argument(
        '--analysis_type',
        choices=['realtime', 'compliance', 'breach_risk', 'trend'],
        required=True,
        help='Type of SLA analysis to perform'
    )
    parser.add_argument(
        '--date_range',
        type=int,
        default=7,
        help='Number of days to analyze (default: 7)'
    )
    parser.add_argument(
        '--service_type',
        choices=['BARQ', 'BULLET'],
        help='Filter by service type'
    )
    parser.add_argument(
        '--hub_id',
        type=int,
        help='Filter by hub ID'
    )
    parser.add_argument(
        '--output',
        choices=['console', 'json'],
        default='console',
        help='Output format (default: console)'
    )

    args = parser.parse_args()

    # Initialize analyzer
    analyzer = SLAAnalytics()
    analyzer.connect()

    try:
        # Perform analysis
        if args.analysis_type == 'realtime':
            results = analyzer.get_realtime_sla_status()
        elif args.analysis_type == 'compliance':
            results = analyzer.analyze_sla_compliance(
                date_range=args.date_range,
                service_type=args.service_type
            )
        elif args.analysis_type == 'breach_risk':
            results = analyzer.identify_breach_risks(hub_id=args.hub_id)
        elif args.analysis_type == 'trend':
            results = analyzer.get_sla_trend(days=args.date_range)

        # Output results
        if args.output == 'json':
            print("\n" + json.dumps(results, indent=2, default=str))
        else:
            print("\n" + "="*80)
            print(f"SLA ANALYSIS: {args.analysis_type.upper()}")
            print("="*80)

            if 'error' in results:
                print(f"\n❌ Error: {results['error']}")
            else:
                if args.analysis_type == 'realtime':
                    status = results.get('status', 'unknown').upper()
                    print(f"\n🚦 Status: {status}")
                    print(f"\n📊 Overall:")
                    if 'overall' in results:
                        print(f"  Active Deliveries: {results['overall']['total_active']}")
                        print(f"  At Risk: {results['overall']['total_at_risk']}")
                        print(f"  Breached: {results['overall']['total_breached']}")

                    if results.get('at_risk_deliveries'):
                        print(f"\n⚠️  At-Risk Deliveries (Top 10):")
                        for delivery in results['at_risk_deliveries'][:10]:
                            urgency_emoji = '🔴' if delivery['urgency'] == 'critical' else '🟡'
                            print(f"  {urgency_emoji} {delivery['order_number']}: {delivery['remaining_minutes']:.1f} min remaining")

                elif args.analysis_type == 'compliance':
                    print(f"\n📊 Overall Compliance: {results['overall']['compliance_rate']:.1f}%")
                    print(f"\n📋 By Service Type:")
                    for st, metrics in results.get('by_service_type', {}).items():
                        status_emoji = '✅' if metrics['status'] == 'excellent' else '🟡' if metrics['status'] == 'good' else '🔴'
                        print(f"  {status_emoji} {st}: {metrics['compliance_rate']:.1f}% ({metrics['total_deliveries']} deliveries)")

                    if 'recommendations' in results:
                        print(f"\n💡 Recommendations:")
                        for rec in results['recommendations']:
                            print(f"  • {rec}")

                elif args.analysis_type == 'breach_risk':
                    print(f"\n⚠️  Risk Factors Identified: {results.get('total_patterns', 0)}")
                    if results.get('risk_factors'):
                        print(f"\n🎯 Top Risk Patterns:")
                        for i, factor in enumerate(results['risk_factors'][:5], 1):
                            print(f"  {i}. {factor['hub_name']} - {factor['day_of_week']} {factor['hour_of_day']}")
                            print(f"     Breaches: {factor['breach_count']}, Avg: {factor['avg_breach_minutes']:.1f} min")

                    if 'recommendations' in results:
                        print(f"\n💡 Recommendations:")
                        for rec in results['recommendations']:
                            print(f"  • {rec}")

            print("\n" + "="*80)

    finally:
        analyzer.disconnect()


if __name__ == "__main__":
    main()
