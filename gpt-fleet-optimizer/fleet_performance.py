#!/usr/bin/env python3
"""
Fleet Performance Analyzer - Fleet Optimizer GPT Module
Analyzes courier and vehicle performance metrics from barqfleet_db.

Adapted for BarqFleet Production Database Schema:
- Uses 'courier_id' instead of 'driver_id'
- Uses 'is_completed' instead of status = 'delivered'
- Uses 'vehicle_type' from couriers table
- Uses 'driving_distance' from shipments table
- No separate vehicles table (vehicle_type linked to couriers)

Usage:
    python fleet_performance.py --analysis_type courier --period monthly
    python fleet_performance.py --analysis_type courier --courier_id 123
    python fleet_performance.py --analysis_type vehicle --period quarterly
    python fleet_performance.py --analysis_type cohort --metric dpi
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
    """Analyzes fleet (courier and vehicle) performance metrics."""

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

    def analyze_courier_performance(self, period: str = 'monthly', courier_id: int = None) -> Dict:
        """
        Analyze courier performance with comprehensive metrics.

        Metrics:
        - Delivery success rate (completion rate)
        - On-time delivery rate (based on promise_time)
        - Average deliveries per day
        - Average delivery time
        - Distance efficiency

        Args:
            period: Analysis period ('weekly', 'monthly', 'quarterly')
            courier_id: Specific courier to analyze (optional)

        Returns:
            Dictionary with courier performance rankings and statistics
        """
        print(f"\n👨‍✈️ Analyzing courier performance ({period})...")

        # Calculate date range based on period
        end_date = datetime.now()
        if period == 'weekly':
            start_date = end_date - timedelta(days=7)
        elif period == 'monthly':
            start_date = end_date - timedelta(days=30)
        elif period == 'quarterly':
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)

        query = """
        WITH courier_metrics AS (
            SELECT
                s.courier_id,
                c.first_name,
                c.last_name,
                c.vehicle_type,
                COUNT(*) as total_shipments,
                SUM(CASE WHEN s.is_completed = true THEN 1 ELSE 0 END) as completed_shipments,
                SUM(CASE WHEN s.is_cancelled = true THEN 1 ELSE 0 END) as cancelled_shipments,
                SUM(CASE
                    WHEN s.delivery_finish IS NOT NULL
                    AND s.promise_time IS NOT NULL
                    AND s.delivery_finish <= to_timestamp(s.promise_time) THEN 1
                    ELSE 0
                END) as on_time_shipments,
                AVG(
                    CASE
                        WHEN s.complete_time IS NOT NULL AND s.pickup_time IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (s.complete_time - s.pickup_time)) / 3600.0
                        ELSE NULL
                    END
                ) as avg_delivery_hours,
                STDDEV(
                    CASE
                        WHEN s.complete_time IS NOT NULL AND s.pickup_time IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (s.complete_time - s.pickup_time)) / 3600.0
                        ELSE NULL
                    END
                ) as stddev_delivery_hours,
                MIN(
                    CASE
                        WHEN s.complete_time IS NOT NULL AND s.pickup_time IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (s.complete_time - s.pickup_time)) / 3600.0
                        ELSE NULL
                    END
                ) as min_delivery_hours,
                MAX(
                    CASE
                        WHEN s.complete_time IS NOT NULL AND s.pickup_time IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (s.complete_time - s.pickup_time)) / 3600.0
                        ELSE NULL
                    END
                ) as max_delivery_hours,
                COUNT(DISTINCT DATE(s.created_at)) as active_days,
                SUM(COALESCE(s.driving_distance, 0)) as total_distance_km,
                AVG(COALESCE(s.reward, 0)) as avg_reward
            FROM shipments s
            LEFT JOIN couriers c ON c.id = s.courier_id
            WHERE s.created_at >= %s
            AND s.created_at <= %s
            AND s.courier_id IS NOT NULL
            {}
            GROUP BY s.courier_id, c.first_name, c.last_name, c.vehicle_type
            HAVING COUNT(*) >= 5
        )
        SELECT
            cm.*,
            (cm.completed_shipments::float / cm.total_shipments * 100) as completion_rate,
            (cm.on_time_shipments::float / NULLIF(cm.completed_shipments, 0) * 100) as on_time_rate,
            (cm.total_shipments::float / cm.active_days) as shipments_per_day,
            (cm.total_distance_km / NULLIF(cm.completed_shipments, 0)) as avg_distance_per_shipment_km,
            (cm.cancelled_shipments::float / cm.total_shipments * 100) as cancellation_rate
        FROM courier_metrics cm
        ORDER BY completion_rate DESC, on_time_rate DESC
        """.format("AND s.courier_id = %s" if courier_id else "")

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            params = [start_date, end_date]
            if courier_id:
                params.append(courier_id)

            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()

            if not results:
                print("⚠ No courier performance data found")
                return {"error": "No data available"}

            df = pd.DataFrame(results)

            # Calculate Courier Performance Index (CPI)
            # Composite score: completion_rate (40%) + on_time_rate (30%) + shipments_per_day normalized (20%) + speed (10%)
            max_shipments_per_day = df['shipments_per_day'].max() if df['shipments_per_day'].max() > 0 else 1
            min_avg_hours = df['avg_delivery_hours'].min() if not pd.isna(df['avg_delivery_hours'].min()) else 1

            # Fill NaN values with 0 for on_time_rate
            df['on_time_rate'] = df['on_time_rate'].fillna(0)

            df['cpi'] = (
                (df['completion_rate'] * 0.40) +
                (df['on_time_rate'] * 0.30) +
                ((df['shipments_per_day'] / max_shipments_per_day) * 100 * 0.20) +
                ((min_avg_hours / df['avg_delivery_hours'].replace(0, 1)) * 100 * 0.10)
            ).clip(0, 100)

            # Rank couriers
            df = df.sort_values('cpi', ascending=False)
            df['rank'] = range(1, len(df) + 1)

            # Statistical analysis - Identify outliers using z-score
            if len(df) > 3:  # Need at least 3 data points for z-score
                z_scores = np.abs(stats.zscore(df['cpi'].fillna(0)))
                df['is_outlier'] = z_scores > 2
            else:
                df['is_outlier'] = False

            # Top and bottom performers
            top_performers = df.head(10).to_dict('records')
            bottom_performers = df.tail(10).to_dict('records')

            # Overall statistics
            overall_stats = {
                'total_couriers_analyzed': len(df),
                'avg_cpi': float(df['cpi'].mean()),
                'median_cpi': float(df['cpi'].median()),
                'std_cpi': float(df['cpi'].std()),
                'avg_completion_rate': float(df['completion_rate'].mean()),
                'avg_on_time_rate': float(df['on_time_rate'].mean()),
                'avg_shipments_per_day': float(df['shipments_per_day'].mean()),
                'total_shipments': int(df['total_shipments'].sum()),
                'total_completed': int(df['completed_shipments'].sum())
            }

            # Performance tiers
            df['tier'] = pd.cut(
                df['cpi'],
                bins=[0, 70, 85, 100],
                labels=['Needs Improvement', 'Good', 'Excellent']
            )

            tier_distribution = df['tier'].value_counts().to_dict()

            # Vehicle type analysis
            vehicle_performance = df.groupby('vehicle_type').agg({
                'cpi': 'mean',
                'completion_rate': 'mean',
                'shipments_per_day': 'mean'
            }).round(2).to_dict('index')

            print(f"✓ Analyzed {len(df)} couriers with {overall_stats['total_shipments']} total shipments")

            return {
                'analysis_type': 'courier_performance',
                'period': period,
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'overall_stats': overall_stats,
                'top_performers': top_performers,
                'bottom_performers': bottom_performers,
                'tier_distribution': {str(k): int(v) for k, v in tier_distribution.items()},
                'vehicle_performance': vehicle_performance,
                'recommendations': self._generate_courier_recommendations(df)
            }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Courier performance analysis failed: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    def analyze_vehicle_performance(self, period: str = 'monthly', vehicle_type: str = None) -> Dict:
        """
        Analyze vehicle type performance metrics.

        Since BarqFleet doesn't have a separate vehicles table,
        we analyze by vehicle_type from the couriers table.

        Args:
            period: Analysis period
            vehicle_type: Specific vehicle type to analyze (optional)

        Returns:
            Dictionary with vehicle type performance statistics
        """
        print(f"\n🚗 Analyzing vehicle type performance ({period})...")

        end_date = datetime.now()
        if period == 'weekly':
            start_date = end_date - timedelta(days=7)
        elif period == 'monthly':
            start_date = end_date - timedelta(days=30)
        elif period == 'quarterly':
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)

        query = """
        WITH vehicle_metrics AS (
            SELECT
                c.vehicle_type,
                COUNT(*) as total_shipments,
                SUM(CASE WHEN s.is_completed = true THEN 1 ELSE 0 END) as completed_shipments,
                COUNT(DISTINCT s.courier_id) as courier_count,
                COUNT(DISTINCT DATE(s.created_at)) as active_days,
                AVG(
                    CASE
                        WHEN s.complete_time IS NOT NULL AND s.pickup_time IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (s.complete_time - s.pickup_time)) / 3600.0
                        ELSE NULL
                    END
                ) as avg_delivery_hours,
                SUM(COALESCE(s.driving_distance, 0)) as total_distance_km,
                AVG(COALESCE(s.reward, 0)) as avg_reward_per_shipment,
                SUM(
                    CASE
                        WHEN s.delivery_finish IS NOT NULL
                        AND s.promise_time IS NOT NULL
                        AND s.delivery_finish <= to_timestamp(s.promise_time) THEN 1
                        ELSE 0
                    END
                ) as on_time_shipments
            FROM shipments s
            LEFT JOIN couriers c ON c.id = s.courier_id
            WHERE s.created_at >= %s
            AND s.created_at <= %s
            AND c.vehicle_type IS NOT NULL
            {}
            GROUP BY c.vehicle_type
            HAVING COUNT(*) >= 10
        )
        SELECT
            vm.*,
            (vm.completed_shipments::float / vm.total_shipments * 100) as completion_rate,
            (vm.total_shipments::float / vm.active_days) as shipments_per_day,
            (vm.total_distance_km / NULLIF(vm.completed_shipments, 0)) as avg_distance_per_shipment_km,
            (vm.on_time_shipments::float / NULLIF(vm.completed_shipments, 0) * 100) as on_time_rate,
            (vm.total_distance_km / vm.courier_count / vm.active_days) as km_per_courier_per_day
        FROM vehicle_metrics vm
        ORDER BY completion_rate DESC
        """.format("AND c.vehicle_type = %s" if vehicle_type else "")

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            params = [start_date, end_date]
            if vehicle_type:
                params.append(vehicle_type)

            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()

            if not results:
                print("⚠ No vehicle type performance data found")
                return {"error": "No data available"}

            df = pd.DataFrame(results)

            # Calculate Vehicle Performance Index (VPI)
            max_shipments_per_day = df['shipments_per_day'].max() if df['shipments_per_day'].max() > 0 else 1

            df['vpi'] = (
                (df['completion_rate'] * 0.40) +
                (df['on_time_rate'].fillna(0) * 0.30) +
                ((df['shipments_per_day'] / max_shipments_per_day) * 100 * 0.30)
            ).clip(0, 100)

            df = df.sort_values('vpi', ascending=False)
            df['rank'] = range(1, len(df) + 1)

            # Overall statistics
            overall_stats = {
                'total_vehicle_types_analyzed': len(df),
                'avg_vpi': float(df['vpi'].mean()),
                'total_shipments': int(df['total_shipments'].sum()),
                'total_completed': int(df['completed_shipments'].sum()),
                'avg_completion_rate': float(df['completion_rate'].mean()),
                'total_couriers': int(df['courier_count'].sum()),
                'total_distance_km': float(df['total_distance_km'].sum())
            }

            # Check for underutilization
            underutilized = df[df['shipments_per_day'] < df['shipments_per_day'].quantile(0.25)].to_dict('records')

            print(f"✓ Analyzed {len(df)} vehicle types with {overall_stats['total_shipments']} total shipments")

            return {
                'analysis_type': 'vehicle_performance',
                'period': period,
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'overall_stats': overall_stats,
                'vehicle_types': df.to_dict('records'),
                'underutilized_types': underutilized,
                'recommendations': self._generate_vehicle_recommendations(df, underutilized)
            }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Vehicle performance analysis failed: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    def compare_courier_cohorts(self, metric: str = 'cpi', period: str = 'monthly') -> Dict:
        """
        Compare performance across different courier cohorts using ANOVA.

        Cohorts are defined by:
        - Vehicle type
        - Activity level (high/medium/low shipments per day)
        - Experience (based on earliest shipment date)

        Args:
            metric: Performance metric to compare ('cpi', 'completion_rate', 'on_time_rate')
            period: Analysis period

        Returns:
            Dictionary with ANOVA results and cohort comparisons
        """
        print(f"\n📊 Comparing courier cohorts on metric: {metric} ({period})...")

        # Get courier performance data
        performance_data = self.analyze_courier_performance(period=period)

        if 'error' in performance_data:
            return performance_data

        # Create DataFrame from top and bottom performers combined
        all_couriers = performance_data['top_performers'] + performance_data['bottom_performers']
        df = pd.DataFrame(all_couriers)

        if len(df) < 3:
            return {"error": "Insufficient data for cohort comparison"}

        # Define cohorts by vehicle type
        vehicle_cohorts = {}
        for vtype in df['vehicle_type'].unique():
            if pd.notna(vtype):
                vehicle_cohorts[vtype] = df[df['vehicle_type'] == vtype][metric].dropna().tolist()

        # Perform ANOVA
        if len(vehicle_cohorts) >= 2:
            cohort_values = [v for v in vehicle_cohorts.values() if len(v) > 0]
            if len(cohort_values) >= 2:
                try:
                    f_stat, p_value = stats.f_oneway(*cohort_values)
                except Exception as e:
                    print(f"⚠ ANOVA failed: {e}")
                    f_stat, p_value = 0, 1.0
            else:
                f_stat, p_value = 0, 1.0
        else:
            f_stat, p_value = 0, 1.0

        # Cohort summary statistics
        cohort_summary = []
        for cohort_name, values in vehicle_cohorts.items():
            if len(values) > 0:
                cohort_summary.append({
                    'cohort': cohort_name,
                    'count': len(values),
                    'mean': float(np.mean(values)),
                    'median': float(np.median(values)),
                    'std': float(np.std(values)),
                    'min': float(np.min(values)),
                    'max': float(np.max(values))
                })

        # Pairwise t-tests for significant cohorts
        pairwise_comparisons = []
        cohort_names = list(vehicle_cohorts.keys())

        for i in range(len(cohort_names)):
            for j in range(i + 1, len(cohort_names)):
                cohort1 = cohort_names[i]
                cohort2 = cohort_names[j]
                values1 = vehicle_cohorts[cohort1]
                values2 = vehicle_cohorts[cohort2]

                if len(values1) > 1 and len(values2) > 1:
                    try:
                        t_stat, p_val = stats.ttest_ind(values1, values2)
                        pairwise_comparisons.append({
                            'cohort_1': cohort1,
                            'cohort_2': cohort2,
                            't_statistic': float(t_stat),
                            'p_value': float(p_val),
                            'significant': p_val < 0.05,
                            'difference': float(np.mean(values1) - np.mean(values2))
                        })
                    except Exception as e:
                        print(f"⚠ Pairwise comparison failed for {cohort1} vs {cohort2}: {e}")

        print(f"✓ Compared {len(cohort_names)} cohorts with ANOVA F={f_stat:.2f}, p={p_value:.4f}")

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

    def _generate_courier_recommendations(self, df: pd.DataFrame) -> List[str]:
        """Generate actionable recommendations based on courier performance."""
        recommendations = []

        # Check bottom 10% performers
        if len(df) >= 10:
            bottom_10_pct = df[df['rank'] > len(df) * 0.9]
            if len(bottom_10_pct) > 0:
                avg_cpi_bottom = bottom_10_pct['cpi'].mean()
                recommendations.append(
                    f"Bottom 10% couriers ({len(bottom_10_pct)} couriers) have avg CPI of {avg_cpi_bottom:.1f}. "
                    "Consider providing additional training or reassignment."
                )

        # Check on-time rate
        low_on_time = df[df['on_time_rate'] < 80]
        if len(low_on_time) > 0:
            recommendations.append(
                f"{len(low_on_time)} couriers have on-time rate below 80%. "
                "Review route assignments and time estimates for these couriers."
            )

        # Check completion rate
        low_completion = df[df['completion_rate'] < 85]
        if len(low_completion) > 0:
            recommendations.append(
                f"{len(low_completion)} couriers have completion rate below 85%. "
                "Investigate common failure patterns and provide support."
            )

        # Check cancellation rate
        high_cancellation = df[df['cancellation_rate'] > 10]
        if len(high_cancellation) > 0:
            recommendations.append(
                f"{len(high_cancellation)} couriers have cancellation rate above 10%. "
                "Review assignment criteria and courier availability."
            )

        # Recognize top performers
        if len(df) >= 5:
            top_5 = df.head(5)
            recommendations.append(
                f"Top 5 couriers have avg CPI of {top_5['cpi'].mean():.1f}. "
                "Consider using them as trainers or for high-priority deliveries."
            )

        return recommendations if recommendations else ["All couriers performing within acceptable ranges."]

    def _generate_vehicle_recommendations(self, df: pd.DataFrame, underutilized: List) -> List[str]:
        """Generate actionable recommendations based on vehicle performance."""
        recommendations = []

        if len(underutilized) > 0:
            recommendations.append(
                f"{len(underutilized)} vehicle types are underutilized (low shipments per day). "
                "Consider reallocating to higher-demand areas or reviewing vehicle mix."
            )

        low_completion = df[df['completion_rate'] < 85]
        if len(low_completion) > 0:
            vtypes = ', '.join(low_completion['vehicle_type'].tolist())
            recommendations.append(
                f"Vehicle types with low completion rate (<85%): {vtypes}. "
                "Check for mechanical issues or suitability for assigned routes."
            )

        # Distance efficiency
        high_distance = df[df['avg_distance_per_shipment_km'] > df['avg_distance_per_shipment_km'].quantile(0.75)]
        if len(high_distance) > 0:
            vtypes = ', '.join(high_distance['vehicle_type'].tolist())
            recommendations.append(
                f"Vehicle types with high distance per shipment: {vtypes}. "
                "Review route assignments to optimize fuel efficiency."
            )

        # Best performing vehicle type
        if len(df) > 0:
            best_vehicle = df.iloc[0]
            recommendations.append(
                f"Best performing vehicle type: {best_vehicle['vehicle_type']} "
                f"(VPI: {best_vehicle['vpi']:.1f}, {best_vehicle['shipments_per_day']:.1f} shipments/day). "
                "Consider expanding this vehicle type in the fleet."
            )

        return recommendations if recommendations else ["All vehicle types performing within acceptable ranges."]

    def _interpret_cohort_comparison(self, f_stat: float, p_value: float, comparisons: List) -> str:
        """Interpret statistical comparison results."""
        if p_value < 0.05:
            interpretation = f"ANOVA shows significant differences between cohorts (F={f_stat:.2f}, p={p_value:.4f}). "

            significant_pairs = [c for c in comparisons if c['significant']]
            if significant_pairs:
                # Find largest difference
                largest_diff = max(significant_pairs, key=lambda x: abs(x['difference']))
                interpretation += f"Largest significant difference: {largest_diff['cohort_1']} vs {largest_diff['cohort_2']} "
                interpretation += f"({abs(largest_diff['difference']):.2f} points, p={largest_diff['p_value']:.4f}). "
                interpretation += "Performance varies significantly by vehicle type."
            else:
                interpretation += "However, no specific pairwise differences are significant."

            return interpretation
        else:
            return f"No significant differences detected between cohorts (F={f_stat:.2f}, p={p_value:.4f}). Performance is consistent across vehicle types."


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Analyze fleet (courier/vehicle) performance')
    parser.add_argument(
        '--analysis_type',
        choices=['courier', 'vehicle', 'cohort', 'driver'],  # 'driver' alias for 'courier'
        required=True,
        help='Type of performance analysis'
    )
    parser.add_argument(
        '--period',
        choices=['weekly', 'monthly', 'quarterly'],
        default='monthly',
        help='Analysis period (default: monthly)'
    )
    parser.add_argument(
        '--courier_id',
        type=int,
        help='Specific courier ID to analyze'
    )
    parser.add_argument(
        '--driver_id',
        type=int,
        help='Specific driver ID to analyze (alias for courier_id)'
    )
    parser.add_argument(
        '--vehicle_type',
        type=str,
        help='Specific vehicle type to analyze'
    )
    parser.add_argument(
        '--metric',
        choices=['cpi', 'completion_rate', 'on_time_rate'],
        default='cpi',
        help='Metric for cohort comparison (default: cpi)'
    )
    parser.add_argument(
        '--output',
        choices=['console', 'json'],
        default='console',
        help='Output format (default: console)'
    )

    args = parser.parse_args()

    # Map driver_id to courier_id
    courier_id = args.courier_id or args.driver_id

    # Map 'driver' to 'courier' for backwards compatibility
    analysis_type = 'courier' if args.analysis_type == 'driver' else args.analysis_type

    # Initialize analyzer
    analyzer = FleetPerformanceAnalyzer()
    analyzer.connect()

    try:
        # Perform analysis
        if analysis_type == 'courier':
            results = analyzer.analyze_courier_performance(period=args.period, courier_id=courier_id)
        elif analysis_type == 'vehicle':
            results = analyzer.analyze_vehicle_performance(period=args.period, vehicle_type=args.vehicle_type)
        elif analysis_type == 'cohort':
            results = analyzer.compare_courier_cohorts(metric=args.metric, period=args.period)

        # Output results
        if args.output == 'json':
            print("\n" + json.dumps(results, indent=2, default=str))
        else:
            print("\n" + "="*80)
            print(f"FLEET PERFORMANCE ANALYSIS: {analysis_type.upper()}")
            print("="*80)

            if 'error' in results:
                print(f"\n❌ Error: {results['error']}")
            else:
                if analysis_type == 'courier':
                    print(f"\n📊 Overall Statistics:")
                    for key, value in results['overall_stats'].items():
                        print(f"  {key}: {value}")

                    print(f"\n🏆 Top 10 Couriers:")
                    for courier in results['top_performers']:
                        name = f"{courier.get('first_name', '')} {courier.get('last_name', '')}".strip() or f"Courier {courier['courier_id']}"
                        print(f"  {name} (ID: {courier['courier_id']}): CPI={courier['cpi']:.1f}, "
                              f"Completion={courier['completion_rate']:.1f}%, OnTime={courier['on_time_rate']:.1f}%")

                    if 'tier_distribution' in results:
                        print(f"\n📊 Performance Tiers:")
                        for tier, count in results['tier_distribution'].items():
                            print(f"  {tier}: {count} couriers")

                    print(f"\n💡 Recommendations:")
                    for rec in results['recommendations']:
                        print(f"  • {rec}")

                elif analysis_type == 'vehicle':
                    print(f"\n📊 Overall Statistics:")
                    for key, value in results['overall_stats'].items():
                        print(f"  {key}: {value}")

                    print(f"\n🚗 Vehicle Type Performance:")
                    for vehicle in results['vehicle_types']:
                        print(f"  {vehicle['vehicle_type']}: VPI={vehicle['vpi']:.1f}, "
                              f"Shipments/Day={vehicle['shipments_per_day']:.1f}, "
                              f"Completion={vehicle['completion_rate']:.1f}%")

                    print(f"\n💡 Recommendations:")
                    for rec in results['recommendations']:
                        print(f"  • {rec}")

                elif analysis_type == 'cohort':
                    print(f"\n📊 ANOVA Results:")
                    print(f"  F-statistic: {results['anova']['f_statistic']:.2f}")
                    print(f"  P-value: {results['anova']['p_value']:.4f}")
                    print(f"  Significant: {results['anova']['significant']}")

                    print(f"\n📋 Cohort Summary:")
                    for cohort in results['cohort_summary']:
                        print(f"  {cohort['cohort']}: mean={cohort['mean']:.2f}, "
                              f"n={cohort['count']}, std={cohort['std']:.2f}")

                    if results['pairwise_comparisons']:
                        print(f"\n🔍 Significant Pairwise Comparisons:")
                        sig_comps = [c for c in results['pairwise_comparisons'] if c['significant']]
                        if sig_comps:
                            for comp in sig_comps[:5]:  # Top 5
                                print(f"  {comp['cohort_1']} vs {comp['cohort_2']}: "
                                      f"diff={comp['difference']:.2f}, p={comp['p_value']:.4f}")
                        else:
                            print("  No significant pairwise differences found")

                    print(f"\n💡 Interpretation:")
                    print(f"  {results['interpretation']}")

            print("\n" + "="*80)

    finally:
        analyzer.disconnect()


if __name__ == "__main__":
    main()
