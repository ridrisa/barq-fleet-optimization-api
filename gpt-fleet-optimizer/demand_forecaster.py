#!/usr/bin/env python3
"""
Demand Forecaster - Fleet Optimizer GPT Module
Predicts delivery demand patterns based on historical data from barqfleet_db.

ENHANCED WITH PRODUCTION DATABASE RESILIENCE:
- Robust error handling with retry logic and exponential backoff
- Automatic fallback to realistic Saudi Arabian demo data when production unavailable
- Circuit breaker pattern for repeated database failures
- Comprehensive connection health monitoring
- Graceful degradation with clear data source indicators

Adapted for BarqFleet Production Database Schema:
- Uses 'orders' and 'shipments' tables
- Uses 'created_at' timestamps for demand analysis
- Calculates patterns from order_status and delivery metrics
- No reliance on daily_orders table (doesn't exist in production)

Usage:
    python demand_forecaster.py --forecast_type hourly --horizon 7
    python demand_forecaster.py --forecast_type daily --hub_id 5
    python demand_forecaster.py --forecast_type resource --horizon 4
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import pandas as pd
import numpy as np

# Import our robust database connection handler
from database_connection import DatabaseConnection, get_database_connection


class DemandForecaster:
    """Forecasts delivery demand patterns for resource planning with production database resilience."""

    def __init__(self, db_config: Dict[str, str] = None, enable_fallback: bool = None):
        """
        Initialize the Demand Forecaster with robust database handling.

        Args:
            db_config: Database configuration. If None, reads from environment.
            enable_fallback: Enable fallback to demo data when production unavailable.
        """
        # Force production only if environment variable is set
        if os.getenv('PRODUCTION_ONLY') == 'true':
            enable_fallback = False
        elif enable_fallback is None:
            enable_fallback = False
        
        self.db = get_database_connection(enable_fallback=enable_fallback)
        self.data_source = 'unknown'

    def connect(self):
        """Establish database connection with resilience."""
        try:
            connected = self.db.connect()
            
            if self.db.is_fallback_mode:
                self.data_source = 'demo'
                print("⚠ Using demo data - Production database unavailable")
                print("📊 Demo data: 52K+ orders, 850+ couriers, 120+ hubs (Saudi Arabia)")
            else:
                self.data_source = 'production'
                print("✓ Connected to BarqFleet production database successfully")
                
            return True
            
        except Exception as e:
            print(f"✗ Database connection failed completely: {e}")
            if not self.db.enable_fallback:
                sys.exit(1)
            return False

    def disconnect(self):
        """Close database connection."""
        self.db.disconnect()
        if not self.db.is_fallback_mode:
            print("✓ Database connection closed")

    def get_connection_info(self) -> Dict:
        """Get current connection status and data source information."""
        status = self.db.get_connection_status()
        status['forecaster_data_source'] = self.data_source
        return status

    def forecast_hourly_demand(self, horizon_days: int = 7, hub_id: int = None) -> Dict:
        """
        Forecast hourly delivery demand based on historical patterns.

        Analyzes:
        - Historical hourly patterns from orders table
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

        # Analyze historical patterns (last 90 days) using orders table
        query = """
        SELECT
            EXTRACT(DOW FROM created_at) as day_of_week,
            EXTRACT(HOUR FROM created_at) as hour_of_day,
            COUNT(*) as order_count,
            DATE(created_at) as order_date
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
        AND created_at < CURRENT_DATE
        {}
        GROUP BY DATE(created_at), EXTRACT(DOW FROM created_at), EXTRACT(HOUR FROM created_at)
        ORDER BY order_date, day_of_week, hour_of_day
        """.format("AND hub_id = %s" if hub_id else "")

        try:
            params = [hub_id] if hub_id else []
            results = self.db.execute_query(query, params, timeout=30.0)

            if not results:
                print("⚠ No historical data found for forecasting")
                return {
                    "error": "Insufficient historical data",
                    "data_source": self.data_source,
                    "fallback_available": self.db.enable_fallback
                }

            df = pd.DataFrame(results)

            # Calculate statistical patterns by day of week and hour
            hourly_stats = df.groupby(['day_of_week', 'hour_of_day']).agg({
                'order_count': ['mean', 'std', 'min', 'max', 'count']
            }).round(2)

            hourly_stats.columns = ['avg_orders', 'std_orders', 'min_orders', 'max_orders', 'sample_count']
            hourly_stats = hourly_stats.reset_index()

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
                    mask = (hourly_stats['day_of_week'] == dow) & (hourly_stats['hour_of_day'] == hour)
                    historical_data = hourly_stats[mask]

                    if len(historical_data) > 0:
                        avg_demand = historical_data['avg_orders'].iloc[0]
                        std_demand = historical_data['std_orders'].iloc[0]

                        if pd.isna(std_demand):
                            std_demand = avg_demand * 0.2  # Default to 20% variation

                        # Calculate confidence based on sample size and variance
                        sample_count = historical_data['sample_count'].iloc[0]
                        cv = std_demand / avg_demand if avg_demand > 0 else 1

                        if sample_count >= 10 and cv < 0.3:
                            confidence = 'high'
                        elif sample_count >= 5 and cv < 0.5:
                            confidence = 'medium'
                        else:
                            confidence = 'low'

                        forecasts.append({
                            'date': forecast_date.strftime('%Y-%m-%d'),
                            'day_of_week': forecast_date.strftime('%A'),
                            'hour': f"{hour:02d}:00",
                            'forecasted_demand': round(avg_demand, 1),
                            'lower_bound': max(0, round(avg_demand - std_demand, 1)),
                            'upper_bound': round(avg_demand + std_demand, 1),
                            'confidence': confidence,
                            'sample_count': int(sample_count)
                        })
                    else:
                        # No historical data for this hour, use overall average
                        overall_avg = df['order_count'].mean()
                        forecasts.append({
                            'date': forecast_date.strftime('%Y-%m-%d'),
                            'day_of_week': forecast_date.strftime('%A'),
                            'hour': f"{hour:02d}:00",
                            'forecasted_demand': round(overall_avg, 1),
                            'lower_bound': 0,
                            'upper_bound': round(overall_avg * 2, 1),
                            'confidence': 'low',
                            'sample_count': 0
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
                'peak_hours_count': len(peak_hours),
                'high_confidence_hours': int(forecast_df[forecast_df['confidence'] == 'high'].shape[0])
            }

            print(f"✓ Generated {len(forecasts)} hourly forecasts")

            return {
                'forecast_type': 'hourly',
                'horizon_days': horizon_days,
                'hub_id': hub_id,
                'data_source': self.data_source,
                'data_quality': 'high' if self.data_source == 'production' else 'demo',
                'forecasts': forecasts,
                'peak_hours': peak_hours[:20],  # Top 20 peak hours
                'statistics': stats,
                'recommendations': self._generate_hourly_recommendations(forecast_df, peak_hours),
                'connection_info': self.get_connection_info()
            }

        except Exception as e:
            print(f"✗ Hourly forecast failed: {e}")
            import traceback
            traceback.print_exc()
            
            return {
                "error": str(e),
                "data_source": self.data_source,
                "fallback_available": self.db.enable_fallback,
                "connection_info": self.get_connection_info() if hasattr(self, 'db') else {},
                "troubleshooting": {
                    "suggestion": "Check database connectivity or try demo mode",
                    "retry_recommended": True,
                    "circuit_breaker_info": "Database may be temporarily unavailable"
                }
            }

    def forecast_daily_demand(self, horizon_days: int = 30, hub_id: int = None) -> Dict:
        """
        Forecast daily delivery demand.

        Analyzes:
        - Day-of-week patterns from orders table
        - Monthly trends
        - Growth rates
        - Seasonal variations

        Args:
            horizon_days: Number of days to forecast
            hub_id: Specific hub to forecast (optional)

        Returns:
            Dictionary with daily demand forecasts
        """
        print(f"\n📅 Forecasting daily demand for next {horizon_days} days...")

        # Query historical daily patterns from orders table
        query = """
        WITH daily_orders AS (
            SELECT
                DATE(created_at) as date,
                EXTRACT(DOW FROM created_at) as day_of_week,
                COUNT(*) as order_count
            FROM orders
            WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
            AND created_at < CURRENT_DATE
            {}
            GROUP BY DATE(created_at), EXTRACT(DOW FROM created_at)
        ),
        dow_averages AS (
            SELECT
                day_of_week,
                AVG(order_count) as avg_orders,
                STDDEV(order_count) as stddev_orders
            FROM daily_orders
            GROUP BY day_of_week
        )
        SELECT
            ds.date,
            ds.day_of_week,
            ds.order_count,
            da.avg_orders,
            da.stddev_orders
        FROM daily_orders ds
        LEFT JOIN dow_averages da ON ds.day_of_week = da.day_of_week
        ORDER BY ds.date
        """.format("AND hub_id = %s" if hub_id else "")

        try:
            params = [hub_id] if hub_id else []
            results = self.db.execute_query(query, params, timeout=30.0)

            if not results:
                print("⚠ No historical data found")
                return {
                    "error": "Insufficient historical data",
                    "data_source": self.data_source,
                    "fallback_available": self.db.enable_fallback
                }

            df = pd.DataFrame(results)

            # Calculate weekly trend (simple linear regression on last 30 days)
            recent_30 = df.tail(30).copy()
            if len(recent_30) > 1:
                x = np.arange(len(recent_30))
                y = recent_30['order_count'].values
                slope, intercept = np.polyfit(x, y, 1)
                daily_growth_rate = slope / np.mean(y) if np.mean(y) > 0 else 0
            else:
                daily_growth_rate = 0

            # Generate forecasts
            forecasts = []
            today = datetime.now()
            dow_averages = df.groupby('day_of_week').agg({
                'avg_orders': 'first',
                'stddev_orders': 'first'
            }).to_dict('index')

            for day_offset in range(horizon_days):
                forecast_date = today + timedelta(days=day_offset)
                dow = forecast_date.weekday() + 1
                if dow == 7:
                    dow = 0

                if dow in dow_averages:
                    base_demand = dow_averages[dow]['avg_orders']
                    std_demand = dow_averages[dow]['stddev_orders'] or 0

                    # Apply trend adjustment (convert Decimal to float for arithmetic operations)
                    trend_adjustment = float(base_demand) * daily_growth_rate * day_offset
                    forecasted = float(base_demand) + trend_adjustment
                    std_demand_float = float(std_demand) if std_demand else 0

                    forecasts.append({
                        'date': forecast_date.strftime('%Y-%m-%d'),
                        'day_of_week': forecast_date.strftime('%A'),
                        'forecasted_demand': round(forecasted, 1),
                        'lower_bound': max(0, round(forecasted - std_demand_float, 1)),
                        'upper_bound': round(forecasted + std_demand_float, 1),
                        'trend_contribution': round(trend_adjustment, 1)
                    })
                else:
                    # Fallback to overall average
                    overall_avg = df['order_count'].mean()
                    forecasts.append({
                        'date': forecast_date.strftime('%Y-%m-%d'),
                        'day_of_week': forecast_date.strftime('%A'),
                        'forecasted_demand': round(overall_avg, 1),
                        'lower_bound': max(0, round(overall_avg * 0.8, 1)),
                        'upper_bound': round(overall_avg * 1.2, 1),
                        'trend_contribution': 0
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
                'data_source': self.data_source,
                'data_quality': 'high' if self.data_source == 'production' else 'demo',
                'forecasts': forecasts,
                'statistics': stats,
                'growth_rate_pct': float(daily_growth_rate * 100),
                'recommendations': self._generate_daily_recommendations(forecast_df, stats),
                'connection_info': self.get_connection_info()
            }

        except Exception as e:
            print(f"✗ Daily forecast failed: {e}")
            import traceback
            traceback.print_exc()
            
            return {
                "error": str(e),
                "data_source": self.data_source,
                "fallback_available": self.db.enable_fallback,
                "connection_info": self.get_connection_info() if hasattr(self, 'db') else {},
                "troubleshooting": {
                    "suggestion": "Check database connectivity or try demo mode",
                    "retry_recommended": True,
                    "circuit_breaker_info": "Database may be temporarily unavailable"
                }
            }

    def forecast_weekly_demand(self, horizon_weeks: int = 4, hub_id: int = None) -> Dict:
        """
        Forecast weekly delivery demand with week-over-week analysis.

        Args:
            horizon_weeks: Number of weeks to forecast
            hub_id: Specific hub to forecast (optional)

        Returns:
            Dictionary with weekly demand forecasts
        """
        print(f"\n📆 Forecasting weekly demand for next {horizon_weeks} weeks...")

        query = """
        WITH weekly_orders AS (
            SELECT
                DATE_TRUNC('week', created_at) as week_start,
                COUNT(*) as order_count
            FROM orders
            WHERE created_at >= CURRENT_DATE - INTERVAL '12 weeks'
            {}
            GROUP BY DATE_TRUNC('week', created_at)
            ORDER BY week_start
        )
        SELECT
            week_start,
            order_count,
            AVG(order_count) OVER (ORDER BY week_start ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) as moving_avg_4week
        FROM weekly_orders
        """.format("AND hub_id = %s" if hub_id else "")

        try:
            params = [hub_id] if hub_id else []
            results = self.db.execute_query(query, params, timeout=30.0)

            if not results:
                return {
                    "error": "Insufficient historical data",
                    "data_source": self.data_source,
                    "fallback_available": self.db.enable_fallback
                }

            df = pd.DataFrame(results)

            # Calculate growth trend
            if len(df) > 1:
                x = np.arange(len(df))
                y = df['order_count'].values
                slope, intercept = np.polyfit(x, y, 1)
                weekly_growth_rate = slope / np.mean(y) if np.mean(y) > 0 else 0
            else:
                weekly_growth_rate = 0

            # Generate forecasts
            forecasts = []
            last_week_start = pd.to_datetime(df['week_start'].iloc[-1])
            last_moving_avg = float(df['moving_avg_4week'].iloc[-1])

            for week_offset in range(1, horizon_weeks + 1):
                forecast_week = last_week_start + timedelta(weeks=week_offset)
                base_forecast = last_moving_avg
                trend_adjustment = base_forecast * weekly_growth_rate * week_offset
                forecasted = base_forecast + trend_adjustment

                forecasts.append({
                    'week_starting': forecast_week.strftime('%Y-%m-%d'),
                    'forecasted_demand': round(forecasted, 1),
                    'lower_bound': max(0, round(forecasted * 0.85, 1)),
                    'upper_bound': round(forecasted * 1.15, 1),
                    'trend_contribution': round(trend_adjustment, 1)
                })

            forecast_df = pd.DataFrame(forecasts)

            stats = {
                'total_weeks': len(forecasts),
                'avg_weekly_demand': float(forecast_df['forecasted_demand'].mean()),
                'weekly_growth_rate': float(weekly_growth_rate * 100),
                'total_forecasted_deliveries': int(forecast_df['forecasted_demand'].sum())
            }

            print(f"✓ Generated {len(forecasts)} weekly forecasts")

            return {
                'forecast_type': 'weekly',
                'horizon_weeks': horizon_weeks,
                'hub_id': hub_id,
                'data_source': self.data_source,
                'data_quality': 'high' if self.data_source == 'production' else 'demo',
                'forecasts': forecasts,
                'statistics': stats,
                'historical_weeks': df.tail(8).to_dict('records'),
                'connection_info': self.get_connection_info()
            }

        except Exception as e:
            print(f"✗ Weekly forecast failed: {e}")
            import traceback
            traceback.print_exc()
            
            return {
                "error": str(e),
                "data_source": self.data_source,
                "fallback_available": self.db.enable_fallback,
                "connection_info": self.get_connection_info() if hasattr(self, 'db') else {},
                "troubleshooting": {
                    "suggestion": "Check database connectivity or try demo mode",
                    "retry_recommended": True,
                    "circuit_breaker_info": "Database may be temporarily unavailable"
                }
            }

    def forecast_resource_requirements(self, horizon_days: int = 7) -> Dict:
        """
        Forecast resource requirements (couriers, vehicles) based on demand.

        Assumes:
        - Average courier handles 15 deliveries per day
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
        DELIVERIES_PER_COURIER = 15
        DELIVERIES_PER_VEHICLE = 20
        BUFFER_FACTOR = 1.20  # 20% buffer

        forecasts = demand_forecast['forecasts']
        resource_plan = []

        for day in forecasts:
            demand = day['forecasted_demand']
            upper_bound = day['upper_bound']

            # Calculate requirements with buffer
            couriers_needed = int(np.ceil((demand * BUFFER_FACTOR) / DELIVERIES_PER_COURIER))
            vehicles_needed = int(np.ceil((demand * BUFFER_FACTOR) / DELIVERIES_PER_VEHICLE))

            # Calculate for peak demand scenario
            couriers_peak = int(np.ceil((upper_bound * BUFFER_FACTOR) / DELIVERIES_PER_COURIER))
            vehicles_peak = int(np.ceil((upper_bound * BUFFER_FACTOR) / DELIVERIES_PER_VEHICLE))

            capacity = couriers_needed * DELIVERIES_PER_COURIER
            utilization = (demand / capacity * 100) if capacity > 0 else 0

            resource_plan.append({
                'date': day['date'],
                'day_of_week': day['day_of_week'],
                'forecasted_demand': day['forecasted_demand'],
                'couriers_required': couriers_needed,
                'vehicles_required': vehicles_needed,
                'couriers_peak_scenario': couriers_peak,
                'vehicles_peak_scenario': vehicles_peak,
                'capacity_utilization_pct': round(utilization, 1)
            })

        resource_df = pd.DataFrame(resource_plan)

        stats = {
            'avg_couriers_required': float(resource_df['couriers_required'].mean()),
            'max_couriers_required': int(resource_df['couriers_required'].max()),
            'avg_vehicles_required': float(resource_df['vehicles_required'].mean()),
            'max_vehicles_required': int(resource_df['vehicles_required'].max()),
            'avg_capacity_utilization': float(resource_df['capacity_utilization_pct'].mean())
        }

        print(f"✓ Generated resource plan for {len(resource_plan)} days")

        return {
            'forecast_type': 'resource_requirements',
            'horizon_days': horizon_days,
            'data_source': demand_forecast.get('data_source', self.data_source),
            'data_quality': 'high' if demand_forecast.get('data_source', self.data_source) == 'production' else 'demo',
            'planning_parameters': {
                'deliveries_per_courier': DELIVERIES_PER_COURIER,
                'deliveries_per_vehicle': DELIVERIES_PER_VEHICLE,
                'buffer_factor': BUFFER_FACTOR
            },
            'resource_plan': resource_plan,
            'statistics': stats,
            'recommendations': self._generate_resource_recommendations(resource_df, stats),
            'connection_info': self.get_connection_info()
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
                    "Ensure maximum courier staffing and vehicle availability."
                )

            # Analyze time patterns
            hour_counts = peak_df.groupby('hour').size().sort_values(ascending=False)
            if len(hour_counts) > 0:
                busiest_hour = hour_counts.index[0]
                recommendations.append(
                    f"Most frequent peak hour: {busiest_hour}. "
                    "Consider staggering courier shifts to ensure coverage."
                )

        avg_demand = forecast_df['forecasted_demand'].mean()
        if avg_demand > 0:
            recommendations.append(
                f"Average hourly demand: {avg_demand:.1f} deliveries. "
                "Plan baseline courier staffing accordingly."
            )

        # Confidence analysis
        high_conf_pct = (forecast_df['confidence'] == 'high').sum() / len(forecast_df) * 100
        if high_conf_pct < 50:
            recommendations.append(
                f"Only {high_conf_pct:.0f}% of forecasts have high confidence. "
                "Consider gathering more historical data for better predictions."
            )

        # Add data source context to recommendations
        if self.data_source == 'demo':
            recommendations.insert(0, "⚠ DEMO DATA: These forecasts use realistic Saudi Arabian demo data. Verify with production data when available.")
            
        return recommendations if recommendations else ["Demand appears stable. Maintain current operations."]

    def _generate_daily_recommendations(self, forecast_df: pd.DataFrame, stats: Dict) -> List[str]:
        """Generate recommendations based on daily forecasts."""
        recommendations = []

        growth_rate = stats.get('daily_growth_rate', 0)
        if growth_rate > 1:
            recommendations.append(
                f"Demand growing at {growth_rate:.2f}% per day. "
                "Consider gradual expansion of fleet capacity and courier hiring."
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
                "Adjust courier staffing schedules accordingly."
            )

        # Variance analysis
        variance = forecast_df['forecasted_demand'].std()
        if variance > stats['avg_daily_demand'] * 0.3:
            recommendations.append(
                "High demand variance detected. Maintain flexible courier pool for peak days."
            )

        # Add data source context to recommendations
        if self.data_source == 'demo':
            recommendations.insert(0, "⚠ DEMO DATA: These forecasts use realistic Saudi Arabian demo data. Verify with production data when available.")
            
        return recommendations if recommendations else ["Demand forecast is stable."]

    def _generate_resource_recommendations(self, resource_df: pd.DataFrame, stats: Dict) -> List[str]:
        """Generate resource planning recommendations."""
        recommendations = []

        max_couriers = stats['max_couriers_required']
        avg_couriers = stats['avg_couriers_required']

        recommendations.append(
            f"Maintain a core team of {int(avg_couriers)} couriers. "
            f"Have capacity to scale up to {max_couriers} couriers for peak days."
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
                "Risk of courier overload. Increase buffer factor or expand fleet."
            )

        # Peak day analysis
        peak_days = resource_df.nlargest(3, 'forecasted_demand')
        if len(peak_days) > 0:
            peak_dates = ', '.join(peak_days['date'].tolist())
            recommendations.append(
                f"Peak demand days: {peak_dates}. "
                "Ensure full courier availability and backup resources."
            )

        # Add data source context to recommendations
        if self.data_source == 'demo':
            recommendations.insert(0, "⚠ DEMO DATA: These forecasts use realistic Saudi Arabian demo data. Verify with production data when available.")
            
        return recommendations


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Forecast delivery demand patterns')
    parser.add_argument(
        '--forecast_type',
        choices=['hourly', 'daily', 'weekly', 'resource'],
        required=True,
        help='Type of forecast to generate'
    )
    parser.add_argument(
        '--horizon',
        type=int,
        default=7,
        help='Forecast horizon in days/weeks (default: 7)'
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
        elif args.forecast_type == 'weekly':
            results = forecaster.forecast_weekly_demand(horizon_weeks=args.horizon, hub_id=args.hub_id)
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
                for key, value in results.get('statistics', {}).items():
                    print(f"  {key}: {value}")

                print(f"\n💡 Recommendations:")
                for rec in results.get('recommendations', []):
                    print(f"  • {rec}")

                if args.forecast_type == 'hourly' and 'peak_hours' in results:
                    print(f"\n⏰ Top 5 Peak Hours:")
                    for peak in results['peak_hours'][:5]:
                        print(f"  {peak['date']} {peak['hour']}: {peak['forecasted_demand']:.0f} deliveries")

                if args.forecast_type == 'resource' and 'resource_plan' in results:
                    print(f"\n👥 Resource Plan (First 7 Days):")
                    for day in results['resource_plan'][:7]:
                        print(f"  {day['date']} ({day['day_of_week']}): "
                              f"{day['couriers_required']} couriers, "
                              f"{day['vehicles_required']} vehicles")

            print("\n" + "="*80)

    finally:
        forecaster.disconnect()


if __name__ == "__main__":
    main()
