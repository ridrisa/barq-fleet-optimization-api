#!/usr/bin/env python3
"""
SLA Analytics - Fleet Optimizer Module
Real-time SLA monitoring and analytics for delivery operations.

Adapted for BarqFleet Production Database Schema:
- Uses promise_time field from shipments table for SLA deadlines
- Uses delivery_finish vs promise_time for compliance calculation
- Uses order_status and shipment_status fields
- No service_type field (assumes all deliveries have SLA requirements)

Focuses on:
- Real-time SLA status monitoring
- SLA compliance tracking
- Breach detection and risk analysis
- Performance zone classification
- Hub-level SLA breakdown

Usage:
    python sla_analytics.py --analysis_type realtime
    python sla_analytics.py --analysis_type compliance --date_range 7
    python sla_analytics.py --analysis_type breach_risk --hub_id 5
    python sla_analytics.py --analysis_type trend --date_range 30
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
    """Analyzes SLA compliance and delivery performance."""

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
                'database': os.getenv('DB_NAME', 'barqfleet_db'),
                'user': os.getenv('DB_USER', 'postgres'),
                'password': os.getenv('DB_PASSWORD', 'postgres')
            }

        self.db_config = db_config
        self.conn = None

    def connect(self):
        """Establish database connection."""
        try:
            self.conn = psycopg2.connect(**self.db_config)
            print("✓ Connected to BarqFleet production database successfully")
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

        # Query active shipments with SLA information
        query = """
        WITH active_shipments AS (
            SELECT
                s.id,
                s.tracking_no,
                s.shipment_status,
                s.created_at,
                s.promise_time,
                s.courier_id,
                s.partner_id,
                EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 60 as elapsed_minutes,
                EXTRACT(EPOCH FROM (to_timestamp(s.promise_time) - NOW())) / 60 as remaining_minutes,
                CASE
                    WHEN s.promise_time IS NULL THEN 60
                    ELSE EXTRACT(EPOCH FROM (to_timestamp(s.promise_time) - s.created_at)) / 60
                END as sla_target_minutes
            FROM shipments s
            WHERE s.is_completed = false
            AND s.is_cancelled = false
            AND s.created_at >= NOW() - INTERVAL '24 hours'
            AND s.promise_time IS NOT NULL
        )
        SELECT
            COUNT(*) as active_count,
            AVG(elapsed_minutes) as avg_elapsed_minutes,
            COUNT(CASE WHEN remaining_minutes < 15 THEN 1 END) as at_risk_count,
            COUNT(CASE WHEN remaining_minutes < 0 THEN 1 END) as breached_count,
            MIN(remaining_minutes) as min_remaining_minutes,
            MAX(elapsed_minutes) as max_elapsed_minutes,
            AVG(sla_target_minutes) as avg_sla_target
        FROM active_shipments
        """

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query)
            results = cursor.fetchone()

            if not results or results['active_count'] == 0:
                print("✓ No active shipments at this time")
                return {
                    'status': 'idle',
                    'active_deliveries': 0,
                    'at_risk': 0,
                    'breached': 0,
                    'timestamp': datetime.now().isoformat()
                }

            # Get at-risk delivery details
            at_risk_query = """
            SELECT
                s.id,
                s.tracking_no,
                s.shipment_status,
                s.courier_id,
                s.partner_id,
                EXTRACT(EPOCH FROM (to_timestamp(s.promise_time) - NOW())) / 60 as remaining_minutes,
                EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 60 as elapsed_minutes
            FROM shipments s
            WHERE s.is_completed = false
            AND s.is_cancelled = false
            AND s.promise_time IS NOT NULL
            AND to_timestamp(s.promise_time) - NOW() < INTERVAL '15 minutes'
            ORDER BY remaining_minutes ASC
            LIMIT 20
            """

            cursor.execute(at_risk_query)
            at_risk_deliveries = cursor.fetchall()
            cursor.close()

            # Process results
            summary = {
                'status': 'active',
                'timestamp': datetime.now().isoformat(),
                'at_risk_deliveries': [],
                'overall': {
                    'total_active': int(results['active_count']),
                    'total_at_risk': int(results['at_risk_count']),
                    'total_breached': int(results['breached_count']),
                    'avg_elapsed_minutes': float(results['avg_elapsed_minutes']) if results['avg_elapsed_minutes'] else 0,
                    'min_remaining_minutes': float(results['min_remaining_minutes']) if results['min_remaining_minutes'] else 0
                }
            }

            # Add at-risk delivery details
            for delivery in at_risk_deliveries:
                urgency = 'critical' if delivery['remaining_minutes'] < 5 else 'high' if delivery['remaining_minutes'] < 10 else 'medium'

                summary['at_risk_deliveries'].append({
                    'id': delivery['id'],
                    'tracking_no': delivery['tracking_no'],
                    'shipment_status': delivery['shipment_status'],
                    'courier_id': delivery['courier_id'],
                    'remaining_minutes': float(delivery['remaining_minutes']),
                    'elapsed_minutes': float(delivery['elapsed_minutes']),
                    'urgency': urgency
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

    def analyze_sla_compliance(self, date_range: int = 7, hub_id: int = None) -> Dict:
        """
        Analyze historical SLA compliance using promise_time vs delivery_finish.

        Args:
            date_range: Number of days to analyze
            hub_id: Filter by hub ID (optional)

        Returns:
            Dictionary with compliance metrics and trends
        """
        print(f"\n📊 Analyzing SLA compliance (last {date_range} days)...")

        end_date = datetime.now()
        start_date = end_date - timedelta(days=date_range)

        # Query completed shipments with SLA compliance data
        query = """
        WITH delivery_performance AS (
            SELECT
                s.id,
                s.tracking_no,
                s.created_at,
                s.promise_time,
                s.delivery_finish,
                s.partner_id,
                o.hub_id,
                EXTRACT(EPOCH FROM (s.delivery_finish - s.created_at)) / 60 as actual_duration_minutes,
                EXTRACT(EPOCH FROM (to_timestamp(s.promise_time) - s.created_at)) / 60 as sla_target_minutes,
                CASE
                    WHEN s.delivery_finish <= to_timestamp(s.promise_time) THEN 1
                    ELSE 0
                END as sla_met,
                EXTRACT(EPOCH FROM (s.delivery_finish - to_timestamp(s.promise_time))) / 60 as breach_minutes
            FROM shipments s
            LEFT JOIN orders o ON o.shipment_id = s.id
            WHERE s.is_completed = true
            AND s.delivery_finish IS NOT NULL
            AND s.promise_time IS NOT NULL
            AND s.delivery_finish >= %s
            AND s.delivery_finish <= %s
            {}
        )
        SELECT
            COUNT(*) as total_deliveries,
            SUM(sla_met) as deliveries_on_time,
            COUNT(*) - SUM(sla_met) as deliveries_breached,
            (SUM(sla_met)::float / COUNT(*) * 100) as compliance_rate,
            AVG(actual_duration_minutes) as avg_duration_minutes,
            AVG(sla_target_minutes) as avg_sla_target,
            AVG(CASE WHEN sla_met = 0 THEN breach_minutes ELSE 0 END) as avg_breach_minutes,
            MAX(breach_minutes) as max_breach_minutes,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY actual_duration_minutes) as median_duration,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY actual_duration_minutes) as p95_duration
        FROM delivery_performance
        """.format("AND o.hub_id = %s" if hub_id else "")

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            params = [start_date, end_date]
            if hub_id:
                params.append(hub_id)

            cursor.execute(query, params)
            result = cursor.fetchone()
            cursor.close()

            if not result or result['total_deliveries'] == 0:
                print("⚠ No delivery data found for the specified period")
                return {"error": "No data available"}

            # Process results
            compliance_rate = float(result['compliance_rate'])
            compliance_data = {
                'analysis_period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'days': date_range
                },
                'overall': {
                    'total_deliveries': int(result['total_deliveries']),
                    'deliveries_on_time': int(result['deliveries_on_time']),
                    'deliveries_breached': int(result['deliveries_breached']),
                    'compliance_rate': compliance_rate,
                    'avg_duration_minutes': float(result['avg_duration_minutes']),
                    'avg_sla_target_minutes': float(result['avg_sla_target']),
                    'avg_breach_minutes': float(result['avg_breach_minutes']) if result['avg_breach_minutes'] else 0,
                    'max_breach_minutes': float(result['max_breach_minutes']) if result['max_breach_minutes'] else 0,
                    'median_duration': float(result['median_duration']),
                    'p95_duration': float(result['p95_duration']),
                    'status': self._get_compliance_status(compliance_rate)
                }
            }

            # Get hub-level breakdown if no specific hub requested
            if not hub_id:
                hub_breakdown = self._get_hub_level_compliance(start_date, end_date)
                compliance_data['by_hub'] = hub_breakdown

            # Get performance zones
            performance_zones = self._get_performance_zones(start_date, end_date, hub_id)
            compliance_data['performance_zones'] = performance_zones

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

    def _get_hub_level_compliance(self, start_date: datetime, end_date: datetime) -> List[Dict]:
        """Get SLA compliance breakdown by hub."""
        query = """
        WITH hub_performance AS (
            SELECT
                o.hub_id,
                h.code as hub_name,
                COUNT(*) as total_deliveries,
                SUM(CASE WHEN s.delivery_finish <= to_timestamp(s.promise_time) THEN 1 ELSE 0 END) as on_time_deliveries,
                (SUM(CASE WHEN s.delivery_finish <= to_timestamp(s.promise_time) THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as compliance_rate,
                AVG(EXTRACT(EPOCH FROM (s.delivery_finish - s.created_at)) / 60) as avg_duration_minutes
            FROM shipments s
            JOIN orders o ON o.shipment_id = s.id
            LEFT JOIN hubs h ON h.id = o.hub_id
            WHERE s.is_completed = true
            AND s.delivery_finish IS NOT NULL
            AND s.promise_time IS NOT NULL
            AND s.delivery_finish >= %s
            AND s.delivery_finish <= %s
            GROUP BY o.hub_id, h.code
            HAVING COUNT(*) >= 10
        )
        SELECT *
        FROM hub_performance
        ORDER BY compliance_rate ASC
        LIMIT 20
        """

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query, [start_date, end_date])
            results = cursor.fetchall()
            cursor.close()

            hub_data = []
            for row in results:
                hub_data.append({
                    'hub_id': row['hub_id'],
                    'hub_name': row['hub_name'] or f"Hub {row['hub_id']}",
                    'total_deliveries': int(row['total_deliveries']),
                    'on_time_deliveries': int(row['on_time_deliveries']),
                    'compliance_rate': float(row['compliance_rate']),
                    'avg_duration_minutes': float(row['avg_duration_minutes']),
                    'status': self._get_compliance_status(float(row['compliance_rate']))
                })

            return hub_data

        except Exception as e:
            print(f"⚠ Hub-level analysis failed: {e}")
            return []

    def _get_performance_zones(self, start_date: datetime, end_date: datetime, hub_id: int = None) -> Dict:
        """Classify deliveries into performance zones (on-time, at-risk, violated)."""
        query = """
        WITH delivery_zones AS (
            SELECT
                CASE
                    WHEN s.delivery_finish <= to_timestamp(s.promise_time) THEN 'on_time'
                    WHEN EXTRACT(EPOCH FROM (s.delivery_finish - to_timestamp(s.promise_time))) / 60 <= 15 THEN 'at_risk'
                    ELSE 'violated'
                END as zone,
                COUNT(*) as count
            FROM shipments s
            LEFT JOIN orders o ON o.shipment_id = s.id
            WHERE s.is_completed = true
            AND s.delivery_finish IS NOT NULL
            AND s.promise_time IS NOT NULL
            AND s.delivery_finish >= %s
            AND s.delivery_finish <= %s
            {}
            GROUP BY zone
        )
        SELECT * FROM delivery_zones
        """.format("AND o.hub_id = %s" if hub_id else "")

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            params = [start_date, end_date]
            if hub_id:
                params.append(hub_id)

            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()

            zones = {'on_time': 0, 'at_risk': 0, 'violated': 0}
            for row in results:
                zones[row['zone']] = int(row['count'])

            total = sum(zones.values())
            if total > 0:
                zones['on_time_pct'] = round(zones['on_time'] / total * 100, 2)
                zones['at_risk_pct'] = round(zones['at_risk'] / total * 100, 2)
                zones['violated_pct'] = round(zones['violated'] / total * 100, 2)

            return zones

        except Exception as e:
            print(f"⚠ Performance zones analysis failed: {e}")
            return {}

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
                s.tracking_no,
                o.hub_id,
                h.code as hub_name,
                s.courier_id,
                s.created_at,
                EXTRACT(HOUR FROM s.created_at) as hour_of_day,
                EXTRACT(DOW FROM s.created_at) as day_of_week,
                EXTRACT(EPOCH FROM (s.delivery_finish - to_timestamp(s.promise_time))) / 60 as breach_minutes,
                s.shipment_status
            FROM shipments s
            LEFT JOIN orders o ON o.shipment_id = s.id
            LEFT JOIN hubs h ON h.id = o.hub_id
            WHERE s.is_completed = true
            AND s.delivery_finish > to_timestamp(s.promise_time)
            AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'
            {}
        )
        SELECT
            hub_name,
            hour_of_day,
            day_of_week,
            COUNT(*) as breach_count,
            AVG(breach_minutes) as avg_breach_minutes,
            MAX(breach_minutes) as max_breach_minutes,
            COUNT(DISTINCT courier_id) as couriers_involved
        FROM recent_breaches
        GROUP BY hub_name, hour_of_day, day_of_week
        HAVING COUNT(*) >= 3
        ORDER BY breach_count DESC, avg_breach_minutes DESC
        LIMIT 50
        """.format("AND o.hub_id = %s" if hub_id else "")

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
                    'hub_name': row['hub_name'] or 'Unknown',
                    'hour_of_day': f"{int(row['hour_of_day']):02d}:00",
                    'day_of_week': day_names[int(row['day_of_week'])],
                    'breach_count': int(row['breach_count']),
                    'avg_breach_minutes': float(row['avg_breach_minutes']),
                    'max_breach_minutes': float(row['max_breach_minutes']),
                    'couriers_involved': int(row['couriers_involved']),
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
                DATE(s.delivery_finish) as delivery_date,
                COUNT(*) as total_deliveries,
                SUM(CASE WHEN s.delivery_finish <= to_timestamp(s.promise_time) THEN 1 ELSE 0 END) as on_time_deliveries,
                (SUM(CASE WHEN s.delivery_finish <= to_timestamp(s.promise_time) THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as compliance_rate,
                AVG(EXTRACT(EPOCH FROM (s.delivery_finish - s.created_at)) / 60) as avg_duration_minutes
            FROM shipments s
            WHERE s.is_completed = true
            AND s.delivery_finish IS NOT NULL
            AND s.promise_time IS NOT NULL
            AND s.delivery_finish >= CURRENT_DATE - INTERVAL '%s days'
            GROUP BY DATE(s.delivery_finish)
            HAVING COUNT(*) >= 5
        )
        SELECT
            delivery_date,
            total_deliveries,
            on_time_deliveries,
            compliance_rate,
            avg_duration_minutes
        FROM daily_compliance
        ORDER BY delivery_date DESC
        """

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query, (days,))
            results = cursor.fetchall()
            cursor.close()

            if not results:
                return {"error": "No data available"}

            df = pd.DataFrame(results)
            df = df.sort_values('delivery_date')

            # Calculate overall trend
            if len(df) > 1:
                x = np.arange(len(df))
                y = df['compliance_rate'].values
                slope, intercept = np.polyfit(x, y, 1)

                trend_data = {
                    'daily_data': df.to_dict('records'),
                    'current_rate': float(df.iloc[-1]['compliance_rate']),
                    'previous_rate': float(df.iloc[0]['compliance_rate']),
                    'trend_slope': float(slope),
                    'trend_direction': 'improving' if slope > 0.1 else 'declining' if slope < -0.1 else 'stable',
                    'avg_rate': float(df['compliance_rate'].mean()),
                    'min_rate': float(df['compliance_rate'].min()),
                    'max_rate': float(df['compliance_rate'].max())
                }

                # Calculate week-over-week change
                if len(df) >= 14:
                    last_week = df.tail(7)['compliance_rate'].mean()
                    prev_week = df.tail(14).head(7)['compliance_rate'].mean()
                    wow_change = ((last_week - prev_week) / prev_week * 100) if prev_week > 0 else 0
                    trend_data['week_over_week_change_pct'] = round(wow_change, 2)

                print(f"✓ Trend analysis complete: {trend_data['trend_direction']}")

                return {
                    'analysis_period_days': days,
                    'trend': trend_data,
                    'timestamp': datetime.now().isoformat()
                }
            else:
                return {
                    'analysis_period_days': days,
                    'trend': {
                        'daily_data': df.to_dict('records'),
                        'message': 'Insufficient data for trend analysis'
                    }
                }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Trend analysis failed: {e}")
            import traceback
            traceback.print_exc()
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

        overall = data['overall']
        rate = overall['compliance_rate']

        if rate < self.WARNING_THRESHOLD:
            recommendations.append(
                f"🔴 CRITICAL: Overall compliance at {rate:.1f}% (target: {self.GOOD_THRESHOLD}%). "
                f"Immediate action required. Average breach: {overall['avg_breach_minutes']:.1f} minutes."
            )
        elif rate < self.GOOD_THRESHOLD:
            recommendations.append(
                f"🟡 WARNING: Overall compliance at {rate:.1f}%. "
                f"Review courier assignments and route optimization."
            )
        elif rate >= self.EXCELLENT_THRESHOLD:
            recommendations.append(
                f"✅ EXCELLENT: Compliance at {rate:.1f}%. "
                f"Maintain current operations."
            )

        # Check if actual duration is close to SLA target
        if overall['avg_sla_target_minutes'] > 0 and overall['avg_duration_minutes'] > overall['avg_sla_target_minutes'] * 0.8:
            recommendations.append(
                f"⚠️ Average delivery time ({overall['avg_duration_minutes']:.1f} min) "
                f"approaching SLA target ({overall['avg_sla_target_minutes']:.1f} min). Consider adding capacity."
            )

        # Hub-specific recommendations
        if 'by_hub' in data and data['by_hub']:
            problem_hubs = [h for h in data['by_hub'] if h['compliance_rate'] < self.WARNING_THRESHOLD]
            if problem_hubs:
                hub_names = ', '.join([h['hub_name'] for h in problem_hubs[:3]])
                recommendations.append(
                    f"🎯 Focus on problem hubs: {hub_names}. "
                    f"These hubs have compliance below {self.WARNING_THRESHOLD}%."
                )

        # Performance zones
        if 'performance_zones' in data:
            zones = data['performance_zones']
            if zones.get('violated', 0) > zones.get('on_time', 0) * 0.1:  # More than 10% violated
                recommendations.append(
                    f"⚠️ {zones.get('violated_pct', 0):.1f}% of deliveries severely violated SLA. "
                    f"Review capacity planning and route optimization."
                )

        return recommendations if recommendations else ["Performance is within acceptable range."]

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
                    f"Review capacity, courier availability, and route efficiency."
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
                f"Consider increasing courier availability during this period."
            )

        # Day of week patterns
        day_breaches = {}
        for factor in risk_factors:
            day = factor['day_of_week']
            day_breaches[day] = day_breaches.get(day, 0) + factor['breach_count']

        if day_breaches:
            worst_day = max(day_breaches.items(), key=lambda x: x[1])
            recommendations.append(
                f"📅 {worst_day[0]} shows highest breach rate ({worst_day[1]} breaches). "
                f"Adjust staffing for this day."
            )

        return recommendations


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='SLA Analytics for Delivery Operations')
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
                hub_id=args.hub_id
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
                            print(f"  {urgency_emoji} {delivery['tracking_no']}: {delivery['remaining_minutes']:.1f} min remaining")

                elif args.analysis_type == 'compliance':
                    print(f"\n📊 Overall Compliance: {results['overall']['compliance_rate']:.1f}%")
                    print(f"   Status: {results['overall']['status'].upper()}")
                    print(f"   Total Deliveries: {results['overall']['total_deliveries']}")
                    print(f"   On Time: {results['overall']['deliveries_on_time']}")
                    print(f"   Breached: {results['overall']['deliveries_breached']}")

                    if 'performance_zones' in results:
                        zones = results['performance_zones']
                        print(f"\n📊 Performance Zones:")
                        print(f"   ✅ On Time: {zones.get('on_time', 0)} ({zones.get('on_time_pct', 0):.1f}%)")
                        print(f"   🟡 At Risk: {zones.get('at_risk', 0)} ({zones.get('at_risk_pct', 0):.1f}%)")
                        print(f"   🔴 Violated: {zones.get('violated', 0)} ({zones.get('violated_pct', 0):.1f}%)")

                    if results.get('by_hub'):
                        print(f"\n🏢 Hub Performance (Bottom 5):")
                        for hub in results['by_hub'][:5]:
                            status_emoji = '✅' if hub['status'] == 'excellent' else '🟡' if hub['status'] == 'good' else '🔴'
                            print(f"  {status_emoji} {hub['hub_name']}: {hub['compliance_rate']:.1f}% ({hub['total_deliveries']} deliveries)")

                    if 'recommendations' in results:
                        print(f"\n💡 Recommendations:")
                        for rec in results['recommendations']:
                            print(f"  • {rec}")

                elif args.analysis_type == 'breach_risk':
                    print(f"\n⚠️  Risk Factors Identified: {results.get('total_patterns', 0)}")
                    if results.get('risk_factors'):
                        print(f"\n🎯 Top Risk Patterns:")
                        for i, factor in enumerate(results['risk_factors'][:5], 1):
                            severity_emoji = '🔴' if factor['severity'] == 'high' else '🟡'
                            print(f"  {i}. {severity_emoji} {factor['hub_name']} - {factor['day_of_week']} {factor['hour_of_day']}")
                            print(f"     Breaches: {factor['breach_count']}, Avg: {factor['avg_breach_minutes']:.1f} min")

                    if 'recommendations' in results:
                        print(f"\n💡 Recommendations:")
                        for rec in results['recommendations']:
                            print(f"  • {rec}")

                elif args.analysis_type == 'trend':
                    if 'trend' in results:
                        trend = results['trend']
                        print(f"\n📈 Trend Direction: {trend.get('trend_direction', 'Unknown').upper()}")
                        print(f"   Current Rate: {trend.get('current_rate', 0):.1f}%")
                        print(f"   Average Rate: {trend.get('avg_rate', 0):.1f}%")
                        if 'week_over_week_change_pct' in trend:
                            change = trend['week_over_week_change_pct']
                            emoji = '📈' if change > 0 else '📉' if change < 0 else '➡️'
                            print(f"   Week-over-Week: {emoji} {change:+.1f}%")

            print("\n" + "="*80)

    finally:
        analyzer.disconnect()


if __name__ == "__main__":
    main()
