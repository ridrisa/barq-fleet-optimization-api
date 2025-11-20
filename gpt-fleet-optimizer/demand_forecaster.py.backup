#!/usr/bin/env python3
"""
Demand Forecaster - Fleet Optimizer GPT Module
Predicts delivery demand patterns based on historical data from barqfleet_db.

Usage:
    python demand_forecaster.py --forecast_type hourly --horizon 7
    python demand_forecaster.py --forecast_type daily --hub_id 5
    python demand_forecaster.py --forecast_type weekly --horizon 4
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


class DemandForecaster:
    """Forecasts delivery demand patterns for resource planning."""

    def __init__(self, db_config: Dict[str, str] = None):
        """
        Initialize the Demand Forecaster.

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

    def forecast_hourly_demand(self, horizon_days: int = 7, hub_id: int = None) -> Dict:
        """
        Forecast hourly delivery demand based on historical patterns.

        Analyzes:
        - Historical hourly patterns
        - Day-of-week variations
        - Trend analysis
        - Peak hour predictions

        Args:
            horizon_days: Number of days to forecast
            hub_id: Specific hub to forecast (optional)

        Returns:
            Dictionary with hourly demand forecasts and resource recommendations
        """
        print(f"\n⏰ Forecasting hourly demand for next {horizon_days} days...")

        # Analyze historical patterns (last 90 days)
        query = """
        SELECT
            EXTRACT(DOW FROM created_at) as day_of_week,
            EXTRACT(HOUR FROM created_at) as hour_of_day,
            COUNT(*) as shipment_count,
            AVG(COUNT(*)) OVER (
                PARTITION BY EXTRACT(DOW FROM created_at), EXTRACT(HOUR FROM created_at)
            ) as avg_for_hour,
            STDDEV(COUNT(*)) OVER (
                PARTITION BY EXTRACT(DOW FROM created_at), EXTRACT(HOUR FROM created_at)
            ) as stddev_for_hour
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
        AND created_at < CURRENT_DATE
        {}
        GROUP BY DATE(created_at), EXTRACT(DOW FROM created_at), EXTRACT(HOUR FROM created_at)
        ORDER BY day_of_week, hour_of_day
        """.format("AND hub_id = %s" if hub_id else "")

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            params = [hub_id] if hub_id else []
            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()

            if not results:
                print("⚠ No historical data found for forecasting")
                return {"error": "Insufficient historical data"}

            df = pd.DataFrame(results)

            # Calculate hourly patterns by day of week
            hourly_patterns = df.groupby(['day_of_week', 'hour_of_day']).agg({
                'shipment_count': ['mean', 'std', 'min', 'max'],
                'avg_for_hour': 'first'
            }).round(2)

            # Generate forecasts for next N days
            forecasts = []
            today = datetime.now()

            for day_offset in range(horizon_days):
                forecast_date = today + timedelta(days=day_offset)
                dow = forecast_date.weekday() + 1  # Monday = 1
                if dow == 7:  # Sunday = 0 in PostgreSQL
                    dow = 0

                for hour in range(24):
                    # Get historical average for this day/hour combination
                    mask = (df['day_of_week'] == dow) & (df['hour_of_day'] == hour)
                    historical_data = df[mask]

                    if len(historical_data) > 0:
                        avg_demand = historical_data['avg_for_hour'].iloc[0]
                        std_demand = historical_data['stddev_for_hour'].iloc[0] or 0

                        # Simple forecast: historical average (can be enhanced with trends)
                        forecasts.append({
                            'date': forecast_date.strftime('%Y-%m-%d'),
                            'day_of_week': forecast_date.strftime('%A'),
                            'hour': f"{hour:02d}:00",
                            'forecasted_demand': round(avg_demand, 1),
                            'lower_bound': max(0, round(avg_demand - std_demand, 1)),
                            'upper_bound': round(avg_demand + std_demand, 1),
                            'confidence': 'medium' if std_demand / avg_demand < 0.3 else 'low' if avg_demand > 0 else 'high'
                        })

            # Identify peak hours
            forecast_df = pd.DataFrame(forecasts)
            peak_threshold = forecast_df['forecasted_demand'].quantile(0.75)
            peak_hours = forecast_df[forecast_df['forecasted_demand'] >= peak_threshold].to_dict('records')

            # Overall statistics
            stats = {
                'total_forecasts': len(forecasts),
                'avg_hourly_demand': float(forecast_df['forecasted_demand'].mean()),
                'peak_demand': float(forecast_df['forecasted_demand'].max()),
                'min_demand': float(forecast_df['forecasted_demand'].min()),
                'peak_hours_count': len(peak_hours)
            }

            print(f"✓ Generated {len(forecasts)} hourly forecasts")

            return {
                'forecast_type': 'hourly',
                'horizon_days': horizon_days,
                'hub_id': hub_id,
                'forecasts': forecasts,
                'peak_hours': peak_hours[:20],  # Top 20 peak hours
                'statistics': stats,
                'recommendations': self._generate_hourly_recommendations(forecast_df, peak_hours)
            }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Hourly forecast failed: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    def forecast_daily_demand(self, horizon_days: int = 30, hub_id: int = None) -> Dict:
        """
        Forecast daily delivery demand.

        Analyzes:
        - Day-of-week patterns
        - Monthly trends
        - Growth rates

        Args:
            horizon_days: Number of days to forecast
            hub_id: Specific hub to forecast (optional)

        Returns:
            Dictionary with daily demand forecasts
        """
        print(f"\n📅 Forecasting daily demand for next {horizon_days} days...")

        query = """
        WITH daily_shipments AS (
            SELECT
                DATE(created_at) as date,
                EXTRACT(DOW FROM created_at) as day_of_week,
                COUNT(*) as shipment_count
            FROM orders
            WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
            AND created_at < CURRENT_DATE
            {}
            GROUP BY DATE(created_at), EXTRACT(DOW FROM created_at)
        ),
        dow_averages AS (
            SELECT
                day_of_week,
                AVG(shipment_count) as avg_shipments,
                STDDEV(shipment_count) as stddev_orders
            FROM daily_orders
            GROUP BY day_of_week
        )
        SELECT
            ds.date,
            ds.day_of_week,
            ds.shipment_count,
            da.avg_shipments,
            da.stddev_orders
        FROM daily_shipments ds
        LEFT JOIN dow_averages da ON ds.day_of_week = da.day_of_week
        ORDER BY ds.date
        """.format("AND hub_id = %s" if hub_id else "")

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            params = [hub_id] if hub_id else []
            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()

            if not results:
                print("⚠ No historical data found")
                return {"error": "Insufficient historical data"}

            df = pd.DataFrame(results)

            # Calculate weekly trend (simple linear regression on last 30 days)
            recent_30 = df.tail(30).copy()
            if len(recent_30) > 1:
                x = np.arange(len(recent_30))
                y = recent_30['shipment_count'].values
                slope, intercept = np.polyfit(x, y, 1)
                daily_growth_rate = slope / np.mean(y) if np.mean(y) > 0 else 0
            else:
                daily_growth_rate = 0

            # Generate forecasts
            forecasts = []
            today = datetime.now()
            dow_averages = df.groupby('day_of_week').agg({
                'avg_shipments': 'first',
                'stddev_shipments': 'first'
            }).to_dict('index')

            for day_offset in range(horizon_days):
                forecast_date = today + timedelta(days=day_offset)
                dow = forecast_date.weekday() + 1
                if dow == 7:
                    dow = 0

                if dow in dow_averages:
                    base_demand = dow_averages[dow]['avg_shipments']
                    std_demand = dow_averages[dow]['stddev_shipments'] or 0

                    # Apply trend adjustment
                    trend_adjustment = base_demand * daily_growth_rate * day_offset
                    forecasted = base_demand + trend_adjustment

                    forecasts.append({
                        'date': forecast_date.strftime('%Y-%m-%d'),
                        'day_of_week': forecast_date.strftime('%A'),
                        'forecasted_demand': round(forecasted, 1),
                        'lower_bound': max(0, round(forecasted - std_demand, 1)),
                        'upper_bound': round(forecasted + std_demand, 1),
                        'trend_contribution': round(trend_adjustment, 1)
                    })

            forecast_df = pd.DataFrame(forecasts)

            stats = {
                'total_days': len(forecasts),
                'avg_daily_demand': float(forecast_df['forecasted_demand'].mean()),
                'peak_demand': float(forecast_df['forecasted_demand'].max()),
                'min_demand': float(forecast_df['forecasted_demand'].min()),
                'daily_growth_rate': float(daily_growth_rate * 100),  # as percentage
                'total_forecasted_deliveries': int(forecast_df['forecasted_demand'].sum())
            }

            print(f"✓ Generated {len(forecasts)} daily forecasts")

            return {
                'forecast_type': 'daily',
                'horizon_days': horizon_days,
                'hub_id': hub_id,
                'forecasts': forecasts,
                'statistics': stats,
                'growth_rate_pct': float(daily_growth_rate * 100),
                'recommendations': self._generate_daily_recommendations(forecast_df, stats)
            }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Daily forecast failed: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    def forecast_resource_requirements(self, horizon_days: int = 7) -> Dict:
        """
        Forecast resource requirements (drivers, vehicles) based on demand.

        Assumes:
        - Average driver handles 15 deliveries per day
        - Average vehicle handles 20 deliveries per day
        - 20% buffer for peak demand

        Args:
            horizon_days: Planning horizon in days

        Returns:
            Dictionary with resource requirement forecasts
        """
        print(f"\n👥 Forecasting resource requirements for next {horizon_days} days...")

        # Get demand forecast first
        demand_forecast = self.forecast_daily_demand(horizon_days=horizon_days)

        if 'error' in demand_forecast:
            return demand_forecast

        # Resource planning parameters
        DELIVERIES_PER_DRIVER = 15
        DELIVERIES_PER_VEHICLE = 20
        BUFFER_FACTOR = 1.20  # 20% buffer

        forecasts = demand_forecast['forecasts']
        resource_plan = []

        for day in forecasts:
            demand = day['forecasted_demand']
            upper_bound = day['upper_bound']

            # Calculate requirements with buffer
            drivers_needed = int(np.ceil((demand * BUFFER_FACTOR) / DELIVERIES_PER_DRIVER))
            vehicles_needed = int(np.ceil((demand * BUFFER_FACTOR) / DELIVERIES_PER_VEHICLE))

            # Calculate for peak demand scenario
            drivers_peak = int(np.ceil((upper_bound * BUFFER_FACTOR) / DELIVERIES_PER_DRIVER))
            vehicles_peak = int(np.ceil((upper_bound * BUFFER_FACTOR) / DELIVERIES_PER_VEHICLE))

            resource_plan.append({
                'date': day['date'],
                'day_of_week': day['day_of_week'],
                'forecasted_demand': day['forecasted_demand'],
                'drivers_required': drivers_needed,
                'vehicles_required': vehicles_needed,
                'drivers_peak_scenario': drivers_peak,
                'vehicles_peak_scenario': vehicles_peak,
                'capacity_utilization_pct': round((demand / (drivers_needed * DELIVERIES_PER_DRIVER)) * 100, 1)
            })

        resource_df = pd.DataFrame(resource_plan)

        stats = {
            'avg_drivers_required': float(resource_df['drivers_required'].mean()),
            'max_drivers_required': int(resource_df['drivers_required'].max()),
            'avg_vehicles_required': float(resource_df['vehicles_required'].mean()),
            'max_vehicles_required': int(resource_df['vehicles_required'].max()),
            'avg_capacity_utilization': float(resource_df['capacity_utilization_pct'].mean())
        }

        print(f"✓ Generated resource plan for {len(resource_plan)} days")

        return {
            'forecast_type': 'resource_requirements',
            'horizon_days': horizon_days,
            'planning_parameters': {
                'deliveries_per_driver': DELIVERIES_PER_DRIVER,
                'deliveries_per_vehicle': DELIVERIES_PER_VEHICLE,
                'buffer_factor': BUFFER_FACTOR
            },
            'resource_plan': resource_plan,
            'statistics': stats,
            'recommendations': self._generate_resource_recommendations(resource_df, stats)
        }

    def _generate_hourly_recommendations(self, forecast_df: pd.DataFrame, peak_hours: List) -> List[str]:
        """Generate recommendations based on hourly forecasts."""
        recommendations = []

        if len(peak_hours) > 0:
            # Group peaks by date to find peak days
            peak_df = pd.DataFrame(peak_hours)
            peak_days = peak_df.groupby('date').size().sort_values(ascending=False)

            if len(peak_days) > 0:
                busiest_day = peak_days.index[0]
                peak_count = peak_days.iloc[0]
                recommendations.append(
                    f"Busiest day: {busiest_day} with {peak_count} peak hours. "
                    "Ensure maximum staffing and vehicle availability."
                )

            # Analyze time patterns
            hour_counts = peak_df.groupby('hour').size().sort_values(ascending=False)
            if len(hour_counts) > 0:
                busiest_hour = hour_counts.index[0]
                recommendations.append(
                    f"Most frequent peak hour: {busiest_hour}. "
                    "Consider staggering shifts to ensure coverage."
                )

        avg_demand = forecast_df['forecasted_demand'].mean()
        if avg_demand > 0:
            recommendations.append(
                f"Average hourly demand: {avg_demand:.1f} deliveries. "
                "Plan baseline staffing accordingly."
            )

        return recommendations if recommendations else ["Demand appears stable. Maintain current operations."]

    def _generate_daily_recommendations(self, forecast_df: pd.DataFrame, stats: Dict) -> List[str]:
        """Generate recommendations based on daily forecasts."""
        recommendations = []

        growth_rate = stats.get('daily_growth_rate', 0)
        if growth_rate > 1:
            recommendations.append(
                f"Demand growing at {growth_rate:.2f}% per day. "
                "Consider gradual expansion of fleet capacity."
            )
        elif growth_rate < -1:
            recommendations.append(
                f"Demand declining at {abs(growth_rate):.2f}% per day. "
                "Review operational efficiency and market conditions."
            )

        # Weekly pattern analysis
        weekday_demand = forecast_df.groupby('day_of_week')['forecasted_demand'].mean().sort_values(ascending=False)
        if len(weekday_demand) > 0:
            busiest_day = weekday_demand.index[0]
            slowest_day = weekday_demand.index[-1]
            recommendations.append(
                f"Busiest day: {busiest_day} ({weekday_demand.iloc[0]:.0f} deliveries). "
                f"Slowest day: {slowest_day} ({weekday_demand.iloc[-1]:.0f} deliveries). "
                "Adjust staffing schedules accordingly."
            )

        return recommendations if recommendations else ["Demand forecast is stable."]

    def _generate_resource_recommendations(self, resource_df: pd.DataFrame, stats: Dict) -> List[str]:
        """Generate resource planning recommendations."""
        recommendations = []

        max_drivers = stats['max_drivers_required']
        avg_drivers = stats['avg_drivers_required']

        recommendations.append(
            f"Maintain a core team of {int(avg_drivers)} drivers. "
            f"Have capacity to scale up to {max_drivers} drivers for peak days."
        )

        max_vehicles = stats['max_vehicles_required']
        avg_vehicles = stats['avg_vehicles_required']

        recommendations.append(
            f"Ensure {max_vehicles} vehicles are available and maintained. "
            f"Average utilization: {int(avg_vehicles)} vehicles per day."
        )

        utilization = stats['avg_capacity_utilization']
        if utilization < 70:
            recommendations.append(
                f"Capacity utilization is low ({utilization:.1f}%). "
                "Consider optimizing resource allocation or adjusting planning parameters."
            )
        elif utilization > 95:
            recommendations.append(
                f"Capacity utilization is very high ({utilization:.1f}%). "
                "Risk of overload. Increase buffer factor or expand fleet."
            )

        return recommendations


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Forecast delivery demand patterns')
    parser.add_argument(
        '--forecast_type',
        choices=['hourly', 'daily', 'resource'],
        required=True,
        help='Type of forecast to generate'
    )
    parser.add_argument(
        '--horizon',
        type=int,
        default=7,
        help='Forecast horizon in days (default: 7)'
    )
    parser.add_argument(
        '--hub_id',
        type=int,
        help='Specific hub ID to forecast'
    )
    parser.add_argument(
        '--output',
        choices=['console', 'json'],
        default='console',
        help='Output format (default: console)'
    )

    args = parser.parse_args()

    # Initialize forecaster
    forecaster = DemandForecaster()
    forecaster.connect()

    try:
        # Generate forecast
        if args.forecast_type == 'hourly':
            results = forecaster.forecast_hourly_demand(horizon_days=args.horizon, hub_id=args.hub_id)
        elif args.forecast_type == 'daily':
            results = forecaster.forecast_daily_demand(horizon_days=args.horizon, hub_id=args.hub_id)
        elif args.forecast_type == 'resource':
            results = forecaster.forecast_resource_requirements(horizon_days=args.horizon)

        # Output results
        if args.output == 'json':
            print("\n" + json.dumps(results, indent=2, default=str))
        else:
            print("\n" + "="*80)
            print(f"DEMAND FORECAST: {args.forecast_type.upper()}")
            print("="*80)

            if 'error' in results:
                print(f"\n❌ Error: {results['error']}")
            else:
                print(f"\n📊 Statistics:")
                for key, value in results['statistics'].items():
                    print(f"  {key}: {value}")

                print(f"\n💡 Recommendations:")
                for rec in results['recommendations']:
                    print(f"  • {rec}")

                if args.forecast_type == 'hourly' and 'peak_hours' in results:
                    print(f"\n⏰ Top 5 Peak Hours:")
                    for peak in results['peak_hours'][:5]:
                        print(f"  {peak['date']} {peak['hour']}: {peak['forecasted_demand']:.0f} deliveries")

            print("\n" + "="*80)

    finally:
        forecaster.disconnect()


if __name__ == "__main__":
    main()
