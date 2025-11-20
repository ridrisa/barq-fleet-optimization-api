#!/usr/bin/env python3
"""
Fleet Performance Analyzer - Fleet Optimizer GPT Module
Analyzes courier performance metrics from BarqFleet production database.

**PRODUCTION SCHEMA COMPATIBLE**
Works with actual BarqFleet schema:
- Couriers (NOT drivers/vehicles) - courier_id in shipments
- Uses vehicle_type from couriers table
- No separate driver_id or vehicle_id fields

Usage:
    python fleet_performance.py --metric delivery_rate --period monthly
    python fleet_performance.py --metric delivery_rate --period daily --courier_id 123
    python fleet_performance.py --analysis_type cohort --period weekly
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import Dict, List
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
import numpy as np
from scipy import stats


class FleetPerformanceAnalyzer:
    """Analyzes fleet (courier) performance metrics."""

    def __init__(self, db_config: Dict[str, str] = None):
        """
        Initialize the Fleet Performance Analyzer.

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

    def analyze_driver_performance(self, period: str = 'monthly', driver_id: int = None) -> Dict:
        """
        Analyze courier performance with comprehensive metrics.

        Metrics:
        - Delivery success rate
        - Average deliveries per day
        - Average delivery time
        - Total distance covered

        Args:
            period: Analysis period ('daily', 'weekly', 'monthly', 'quarterly')
            driver_id: Specific courier to analyze (optional) - maps to courier_id

        Returns:
            Dictionary with courier performance rankings and statistics
        """
        print(f"\n👨‍✈️ Analyzing courier performance ({period})...")

        # Calculate date range based on period
        end_date = datetime.now()
        if period == 'daily':
            start_date = end_date - timedelta(days=1)
        elif period == 'weekly':
            start_date = end_date - timedelta(days=7)
        elif period == 'monthly':
            start_date = end_date - timedelta(days=30)
        elif period == 'quarterly':
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)

        # Use actual production schema - courier_id in shipments
        query = """
        WITH courier_metrics AS (
            SELECT
                s.courier_id,
                c.first_name,
                c.last_name,
                c.mobile_number,
                c.vehicle_type,
                COUNT(*) as total_deliveries,
                SUM(CASE WHEN o.order_status = 'delivered' THEN 1 ELSE 0 END) as successful_deliveries,
                AVG(
                    CASE
                        WHEN o.delivery_finish IS NOT NULL AND o.delivery_start IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (o.delivery_finish - o.delivery_start)) / 3600.0
                        ELSE NULL
                    END
                ) as avg_delivery_hours,
                STDDEV(
                    CASE
                        WHEN o.delivery_finish IS NOT NULL AND o.delivery_start IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (o.delivery_finish - o.delivery_start)) / 3600.0
                        ELSE NULL
                    END
                ) as stddev_delivery_hours,
                MIN(
                    CASE
                        WHEN o.delivery_finish IS NOT NULL AND o.delivery_start IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (o.delivery_finish - o.delivery_start)) / 3600.0
                        ELSE NULL
                    END
                ) as min_delivery_hours,
                MAX(
                    CASE
                        WHEN o.delivery_finish IS NOT NULL AND o.delivery_start IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (o.delivery_finish - o.delivery_start)) / 3600.0
                        ELSE NULL
                    END
                ) as max_delivery_hours,
                COUNT(DISTINCT DATE(o.created_at)) as active_days,
                SUM(COALESCE(s.driving_distance, 0)) as total_distance_km
            FROM shipments s
            INNER JOIN orders o ON o.shipment_id = s.id
            LEFT JOIN couriers c ON c.id = s.courier_id
            WHERE o.created_at >= %s
            AND o.created_at <= %s
            AND s.courier_id IS NOT NULL
            {}
            GROUP BY s.courier_id, c.first_name, c.last_name, c.mobile_number, c.vehicle_type
            HAVING COUNT(*) >= 5
        )
        SELECT
            cm.*,
            (cm.successful_deliveries::float / cm.total_deliveries * 100) as success_rate,
            (cm.total_deliveries::float / NULLIF(cm.active_days, 0)) as deliveries_per_day,
            (cm.total_distance_km / NULLIF(cm.total_deliveries, 0)) as avg_distance_per_delivery_km
        FROM courier_metrics cm
        ORDER BY success_rate DESC
        """.format("AND s.courier_id = %s" if driver_id else "")

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            params = [start_date, end_date]
            if driver_id:
                params.append(driver_id)

            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()

            if not results:
                print("⚠ No courier performance data found")
                return {"error": "No data available"}

            df = pd.DataFrame(results)

            # Handle null values
            df['avg_delivery_hours'] = df['avg_delivery_hours'].fillna(df['avg_delivery_hours'].median())
            df['deliveries_per_day'] = df['deliveries_per_day'].fillna(0)

            # Calculate Driver Performance Index (DPI)
            # Composite score: success_rate (40%) + deliveries_per_day normalized (30%) + speed (30%)
            max_deliveries_per_day = df['deliveries_per_day'].max() if df['deliveries_per_day'].max() > 0 else 1
            min_avg_hours = df['avg_delivery_hours'].min() if df['avg_delivery_hours'].min() > 0 else 1

            df['dpi'] = (
                (df['success_rate'] * 0.40) +
                ((df['deliveries_per_day'] / max_deliveries_per_day) * 100 * 0.30) +
                ((min_avg_hours / df['avg_delivery_hours']) * 100 * 0.30)
            ).clip(0, 100)

            # Rank drivers
            df = df.sort_values('dpi', ascending=False)
            df['rank'] = range(1, len(df) + 1)

            # Statistical analysis
            # Identify outliers using z-score
            if len(df) > 2:
                z_scores = np.abs(stats.zscore(df['dpi'].fillna(df['dpi'].mean())))
                df['is_outlier'] = z_scores > 2
            else:
                df['is_outlier'] = False

            # Top and bottom performers
            top_performers = df.head(10).to_dict('records')
            bottom_performers = df.tail(10).to_dict('records')

            # Overall statistics
            overall_stats = {
                'total_drivers_analyzed': len(df),
                'avg_dpi': float(df['dpi'].mean()),
                'median_dpi': float(df['dpi'].median()),
                'std_dpi': float(df['dpi'].std()) if len(df) > 1 else 0,
                'avg_success_rate': float(df['success_rate'].mean()),
                'avg_deliveries_per_day': float(df['deliveries_per_day'].mean()),
                'total_deliveries': int(df['total_deliveries'].sum())
            }

            # Performance tiers
            df['tier'] = pd.cut(
                df['dpi'],
                bins=[0, 70, 85, 100],
                labels=['Needs Improvement', 'Good', 'Excellent']
            )

            tier_distribution = df['tier'].value_counts().to_dict()

            print(f"✓ Analyzed {len(df)} couriers with {overall_stats['total_deliveries']} total deliveries")

            return {
                'analysis_type': 'driver_performance',
                'period': period,
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'overall_stats': overall_stats,
                'tier_distribution': {str(k): int(v) for k, v in tier_distribution.items()},
                'top_performers': top_performers,
                'bottom_performers': bottom_performers,
                'all_drivers': df.to_dict('records'),
                'recommendations': self._generate_driver_recommendations(df)
            }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Courier performance analysis failed: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    def analyze_vehicle_performance(self, period: str = 'monthly', vehicle_id: int = None) -> Dict:
        """
        Analyze vehicle type performance and utilization.

        Note: In production schema, there's no separate vehicle_id - we analyze by vehicle_type

        Metrics:
        - Utilization rate by vehicle type
        - Average deliveries per vehicle type
        - Efficiency (deliveries per km)

        Args:
            period: Analysis period
            vehicle_id: Specific vehicle type to analyze (optional) - actually filters by courier

        Returns:
            Dictionary with vehicle type performance metrics
        """
        print(f"\n🚚 Analyzing vehicle performance ({period})...")

        end_date = datetime.now()
        if period == 'daily':
            start_date = end_date - timedelta(days=1)
        elif period == 'weekly':
            start_date = end_date - timedelta(days=7)
        elif period == 'monthly':
            start_date = end_date - timedelta(days=30)
        elif period == 'quarterly':
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)

        # Analyze by vehicle_type since we don't have individual vehicle IDs
        query = """
        WITH vehicle_metrics AS (
            SELECT
                c.vehicle_type,
                COUNT(*) as total_trips,
                COUNT(DISTINCT s.courier_id) as couriers_used,
                COUNT(DISTINCT DATE(o.created_at)) as active_days,
                SUM(CASE WHEN o.order_status = 'delivered' THEN 1 ELSE 0 END) as successful_deliveries,
                AVG(
                    CASE
                        WHEN o.delivery_finish IS NOT NULL AND o.delivery_start IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (o.delivery_finish - o.delivery_start)) / 3600.0
                        ELSE NULL
                    END
                ) as avg_trip_hours,
                SUM(COALESCE(s.driving_distance, 0)) as total_distance_km
            FROM shipments s
            INNER JOIN orders o ON o.shipment_id = s.id
            LEFT JOIN couriers c ON c.id = s.courier_id
            WHERE o.created_at >= %s
            AND o.created_at <= %s
            AND c.vehicle_type IS NOT NULL
            {}
            GROUP BY c.vehicle_type
            HAVING COUNT(*) >= 5
        )
        SELECT
            vm.*,
            (vm.successful_deliveries::float / vm.total_trips * 100) as success_rate,
            (vm.total_trips::float / NULLIF(vm.active_days, 0)) as trips_per_day,
            (vm.total_distance_km / NULLIF(vm.total_trips, 0)) as avg_distance_per_trip_km,
            (vm.total_trips::float / NULLIF(vm.total_distance_km, 0)) as deliveries_per_km_efficiency
        FROM vehicle_metrics vm
        ORDER BY success_rate DESC, trips_per_day DESC
        """.format("AND s.courier_id = %s" if vehicle_id else "")

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            params = [start_date, end_date]
            if vehicle_id:
                params.append(vehicle_id)

            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()

            if not results:
                print("⚠ No vehicle performance data found")
                return {"error": "No data available"}

            df = pd.DataFrame(results)

            # Handle null values
            df['trips_per_day'] = df['trips_per_day'].fillna(0)
            df['deliveries_per_km_efficiency'] = df['deliveries_per_km_efficiency'].fillna(0)

            # Calculate Vehicle Performance Index (VPI)
            # success_rate (50%) + utilization (30%) + efficiency (20%)
            max_trips_per_day = df['trips_per_day'].max() if df['trips_per_day'].max() > 0 else 1
            max_efficiency = df['deliveries_per_km_efficiency'].max() if df['deliveries_per_km_efficiency'].max() > 0 else 1

            df['vpi'] = (
                (df['success_rate'] * 0.50) +
                ((df['trips_per_day'] / max_trips_per_day) * 100 * 0.30) +
                ((df['deliveries_per_km_efficiency'] / max_efficiency) * 100 * 0.20)
            ).clip(0, 100)

            # Rank vehicle types
            df = df.sort_values('vpi', ascending=False)
            df['rank'] = range(1, len(df) + 1)

            # Utilization categories
            if len(df) > 1:
                df['utilization'] = pd.cut(
                    df['trips_per_day'],
                    bins=[0, df['trips_per_day'].quantile(0.33), df['trips_per_day'].quantile(0.66), float('inf')],
                    labels=['Low', 'Medium', 'High']
                )
            else:
                df['utilization'] = 'Medium'

            top_performers = df.head(10).to_dict('records')
            underutilized = df[df['utilization'] == 'Low'].to_dict('records') if len(df) > 1 else []

            overall_stats = {
                'total_vehicle_types_analyzed': len(df),
                'avg_vpi': float(df['vpi'].mean()),
                'avg_success_rate': float(df['success_rate'].mean()),
                'avg_trips_per_day': float(df['trips_per_day'].mean()),
                'total_trips': int(df['total_trips'].sum()),
                'total_distance_km': float(df['total_distance_km'].sum())
            }

            utilization_dist = df['utilization'].value_counts().to_dict()

            print(f"✓ Analyzed {len(df)} vehicle types with {overall_stats['total_trips']} total trips")

            return {
                'analysis_type': 'vehicle_performance',
                'period': period,
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'overall_stats': overall_stats,
                'utilization_distribution': {str(k): int(v) for k, v in utilization_dist.items()},
                'top_performers': top_performers,
                'underutilized_vehicles': underutilized,
                'all_vehicles': df.to_dict('records'),
                'recommendations': self._generate_vehicle_recommendations(df, underutilized)
            }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Vehicle performance analysis failed: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    def compare_driver_cohorts(self, metric: str = 'dpi', period: str = 'monthly') -> Dict:
        """
        Compare courier performance across cohorts with statistical testing.

        Performs:
        - ANOVA to detect significant differences
        - T-tests for pairwise comparisons
        - Cohort segmentation

        Args:
            metric: Metric to compare ('dpi', 'success_rate')
            period: Analysis period

        Returns:
            Dictionary with statistical comparison results
        """
        print(f"\n📊 Comparing courier cohorts on metric: {metric}...")

        # First get driver performance data
        driver_data = self.analyze_driver_performance(period=period)

        if 'error' in driver_data:
            return driver_data

        df = pd.DataFrame(driver_data['all_drivers'])

        if metric not in df.columns:
            return {"error": f"Metric {metric} not found in driver data"}

        # Create cohorts based on tier
        cohorts = df.groupby('tier')[metric].apply(list).to_dict()

        # Perform ANOVA
        cohort_values = [values for values in cohorts.values() if len(values) > 0]
        if len(cohort_values) < 2:
            return {"error": "Insufficient cohorts for comparison"}

        f_stat, p_value = stats.f_oneway(*cohort_values)

        # Pairwise t-tests
        tier_names = list(cohorts.keys())
        pairwise_comparisons = []

        for i in range(len(tier_names)):
            for j in range(i + 1, len(tier_names)):
                tier1 = tier_names[i]
                tier2 = tier_names[j]

                if len(cohorts[tier1]) > 0 and len(cohorts[tier2]) > 0:
                    t_stat, t_p_value = stats.ttest_ind(cohorts[tier1], cohorts[tier2])

                    pairwise_comparisons.append({
                        'cohort_1': str(tier1),
                        'cohort_2': str(tier2),
                        'cohort_1_mean': float(np.mean(cohorts[tier1])),
                        'cohort_2_mean': float(np.mean(cohorts[tier2])),
                        'difference': float(np.mean(cohorts[tier1]) - np.mean(cohorts[tier2])),
                        't_statistic': float(t_stat),
                        'p_value': float(t_p_value),
                        'significant': t_p_value < 0.05
                    })

        cohort_summary = {
            str(tier): {
                'count': len(values),
                'mean': float(np.mean(values)),
                'median': float(np.median(values)),
                'std': float(np.std(values)),
                'min': float(np.min(values)),
                'max': float(np.max(values))
            }
            for tier, values in cohorts.items() if len(values) > 0
        }

        print(f"✓ Compared {len(cohorts)} cohorts with {len(df)} total couriers")

        return {
            'analysis_type': 'cohort_comparison',
            'metric': metric,
            'period': period,
            'anova': {
                'f_statistic': float(f_stat),
                'p_value': float(p_value),
                'significant': p_value < 0.05
            },
            'cohort_summary': cohort_summary,
            'pairwise_comparisons': pairwise_comparisons,
            'interpretation': self._interpret_cohort_comparison(f_stat, p_value, pairwise_comparisons)
        }

    def _generate_driver_recommendations(self, df: pd.DataFrame) -> List[str]:
        """Generate actionable recommendations based on courier performance."""
        recommendations = []

        # Check bottom 10% performers
        if len(df) > 10:
            bottom_10_pct = df[df['rank'] > len(df) * 0.9]
            if len(bottom_10_pct) > 0:
                avg_dpi_bottom = bottom_10_pct['dpi'].mean()
                recommendations.append(
                    f"Bottom 10% couriers ({len(bottom_10_pct)} couriers) have avg DPI of {avg_dpi_bottom:.1f}. "
                    "Consider providing additional training or reassignment."
                )

        # Check success rate
        low_success = df[df['success_rate'] < 85]
        if len(low_success) > 0:
            recommendations.append(
                f"{len(low_success)} couriers have success rate below 85%. "
                "Investigate common failure patterns and provide support."
            )

        # Recognize top performers
        if len(df) >= 5:
            top_5 = df.head(5)
            recommendations.append(
                f"Top 5 couriers have avg DPI of {top_5['dpi'].mean():.1f}. "
                "Consider using them as trainers or for high-priority deliveries."
            )

        return recommendations if recommendations else ["All couriers performing within acceptable ranges."]

    def _generate_vehicle_recommendations(self, df: pd.DataFrame, underutilized: List) -> List[str]:
        """Generate actionable recommendations based on vehicle type performance."""
        recommendations = []

        if len(underutilized) > 0:
            recommendations.append(
                f"{len(underutilized)} vehicle types are underutilized (low trips per day). "
                "Consider reallocating to higher-demand areas."
            )

        low_success = df[df['success_rate'] < 85]
        if len(low_success) > 0:
            recommendations.append(
                f"{len(low_success)} vehicle types have success rate below 85%. "
                "Check for mechanical issues or courier training needs."
            )

        return recommendations if recommendations else ["All vehicle types performing within acceptable ranges."]

    def _interpret_cohort_comparison(self, f_stat: float, p_value: float, comparisons: List) -> str:
        """Interpret statistical comparison results."""
        if p_value < 0.05:
            interpretation = f"ANOVA shows significant differences between cohorts (p={p_value:.4f}). "

            significant_pairs = [c for c in comparisons if c['significant']]
            if significant_pairs:
                largest_diff = max(significant_pairs, key=lambda x: abs(x['difference']))
                interpretation += f"Largest significant difference: {largest_diff['cohort_1']} vs {largest_diff['cohort_2']} "
                interpretation += f"({abs(largest_diff['difference']):.2f} points, p={largest_diff['p_value']:.4f})."

            return interpretation
        else:
            return f"No significant differences detected between cohorts (p={p_value:.4f})."


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Analyze fleet (courier/vehicle) performance')
    parser.add_argument(
        '--metric',
        choices=['delivery_rate', 'time_compliance', 'efficiency'],
        required=True,
        help='Performance metric to analyze'
    )
    parser.add_argument(
        '--period',
        choices=['daily', 'weekly', 'monthly', 'quarterly'],
        default='monthly',
        help='Analysis period (default: monthly)'
    )
    parser.add_argument(
        '--driver_id',
        type=int,
        help='Specific courier ID to analyze (maps to courier_id)'
    )
    parser.add_argument(
        '--vehicle_id',
        type=int,
        help='Specific courier ID for vehicle analysis (maps to courier_id)'
    )
    parser.add_argument(
        '--courier_id',
        type=int,
        help='Specific courier ID to analyze'
    )
    parser.add_argument(
        '--analysis_type',
        choices=['driver', 'vehicle', 'cohort'],
        default='driver',
        help='Type of performance analysis (default: driver)'
    )
    parser.add_argument(
        '--output',
        choices=['console', 'json'],
        default='console',
        help='Output format (default: console)'
    )

    args = parser.parse_args()

    # Initialize analyzer
    analyzer = FleetPerformanceAnalyzer()
    analyzer.connect()

    try:
        # Map driver_id or courier_id to actual courier ID
        courier_id = args.courier_id or args.driver_id

        # Perform analysis
        if args.analysis_type == 'driver':
            results = analyzer.analyze_driver_performance(period=args.period, driver_id=courier_id)
        elif args.analysis_type == 'vehicle':
            results = analyzer.analyze_vehicle_performance(period=args.period, vehicle_id=args.vehicle_id)
        elif args.analysis_type == 'cohort':
            results = analyzer.compare_driver_cohorts(metric='dpi', period=args.period)

        # Output results
        if args.output == 'json':
            print("\n" + json.dumps(results, indent=2, default=str))
        else:
            print("\n" + "="*80)
            print(f"FLEET PERFORMANCE ANALYSIS: {args.analysis_type.upper()}")
            print("="*80)

            if 'error' in results:
                print(f"\n❌ Error: {results['error']}")
            else:
                if args.analysis_type == 'driver':
                    print(f"\n📊 Overall Statistics:")
                    for key, value in results['overall_stats'].items():
                        print(f"  {key}: {value}")

                    print(f"\n🏆 Top 10 Couriers:")
                    for driver in results['top_performers']:
                        print(f"  Courier {driver['courier_id']} ({driver.get('first_name', 'Unknown')}): DPI={driver['dpi']:.1f}, Success={driver['success_rate']:.1f}%")

                    print(f"\n💡 Recommendations:")
                    for rec in results['recommendations']:
                        print(f"  • {rec}")

                elif args.analysis_type == 'vehicle':
                    print(f"\n📊 Overall Statistics:")
                    for key, value in results['overall_stats'].items():
                        print(f"  {key}: {value}")

                    print(f"\n🏆 Top Vehicle Types:")
                    for vehicle in results['top_performers']:
                        print(f"  Vehicle Type: {vehicle['vehicle_type']}, VPI={vehicle['vpi']:.1f}, Trips/Day={vehicle['trips_per_day']:.1f}")

                    print(f"\n💡 Recommendations:")
                    for rec in results['recommendations']:
                        print(f"  • {rec}")

                elif args.analysis_type == 'cohort':
                    print(f"\n📊 ANOVA Results:")
                    print(f"  F-statistic: {results['anova']['f_statistic']:.2f}")
                    print(f"  P-value: {results['anova']['p_value']:.4f}")
                    print(f"  Significant: {results['anova']['significant']}")

                    print(f"\n💡 Interpretation:")
                    print(f"  {results['interpretation']}")

            print("\n" + "="*80)

    finally:
        analyzer.disconnect()


if __name__ == "__main__":
    main()
