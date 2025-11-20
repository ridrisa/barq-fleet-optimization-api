#!/usr/bin/env python3
"""Simplified Demand Forecaster - Production Compatible"""
import os, sys, json, argparse, psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import pandas as pd

class DemandForecaster:
    def __init__(self):
        self.conn = None
        self.db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': int(os.getenv('DB_PORT', 5432)),
            'database': os.getenv('DB_NAME', 'barqfleet_db'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD', 'postgres')
        }
    
    def connect(self):
        self.conn = psycopg2.connect(**self.db_config)
        print("✓ Connected to BarqFleet production database")
    
    def disconnect(self):
        if self.conn:
            self.conn.close()
            print("✓ Database connection closed")
    
    def forecast_hourly_demand(self, horizon_days=7, hub_id=None):
        print(f"\n⏰ Forecasting hourly demand for next {horizon_days} days...")
        query = """
        SELECT 
            EXTRACT(HOUR FROM created_at) as hour_of_day,
            EXTRACT(DOW FROM created_at) as day_of_week,
            COUNT(*) as order_count,
            AVG(COUNT(*)) OVER (PARTITION BY EXTRACT(HOUR FROM created_at)) as avg_hourly
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        {}
        GROUP BY EXTRACT(HOUR FROM created_at), EXTRACT(DOW FROM created_at), DATE(created_at)
        ORDER BY hour_of_day, day_of_week
        """.format("AND hub_id = %s" if hub_id else "")
        
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(query, [hub_id] if hub_id else [])
        results = cursor.fetchall()
        cursor.close()
        
        if not results:
            return {"error": "No data available"}
        
        df = pd.DataFrame(results)
        forecast = df.groupby('hour_of_day').agg({
            'order_count': ['mean', 'std', 'max']
        }).round(2)
        
        print(f"✓ Generated forecast for {len(forecast)} hours")
        return {
            'forecast_type': 'hourly',
            'horizon_days': horizon_days,
            'hub_id': hub_id,
            'hourly_forecast': forecast.to_dict('index'),
            'summary': {'avg_daily_orders': int(df['order_count'].sum() / 30)}
        }
    
    def forecast_daily_demand(self, horizon_days=7, hub_id=None):
        print(f"\n📅 Forecasting daily demand for next {horizon_days} days...")
        query = """
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as order_count
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
        {}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 90
        """.format("AND hub_id = %s" if hub_id else "")
        
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(query, [hub_id] if hub_id else [])
        results = cursor.fetchall()
        cursor.close()
        
        if not results:
            return {"error": "No data available"}
        
        df = pd.DataFrame(results)
        avg_daily = df['order_count'].mean()
        
        print(f"✓ Generated daily forecast based on {len(df)} days")
        return {
            'forecast_type': 'daily',
            'horizon_days': horizon_days,
            'hub_id': hub_id,
            'avg_daily_orders': int(avg_daily),
            'forecast': [int(avg_daily) for _ in range(horizon_days)],
            'historical_data': df.head(30).to_dict('records')
        }

parser = argparse.ArgumentParser()
parser.add_argument('--forecast_type', choices=['hourly', 'daily', 'resource'], default='daily')
parser.add_argument('--horizon', type=int, default=7)
parser.add_argument('--hub_id', type=int)
parser.add_argument('--output', choices=['console', 'json'], default='console')
args = parser.parse_args()

forecaster = DemandForecaster()
forecaster.connect()
try:
    if args.forecast_type == 'hourly':
        results = forecaster.forecast_hourly_demand(args.horizon, args.hub_id)
    else:
        results = forecaster.forecast_daily_demand(args.horizon, args.hub_id)
    
    if args.output == 'json':
        print("\n" + json.dumps(results, indent=2, default=str))
    else:
        print("\n" + "="*80)
        print(f"DEMAND FORECAST: {args.forecast_type.upper()}")
        print("="*80)
        if 'error' in results:
            print(f"\n❌ Error: {results['error']}")
        else:
            print(f"\n📊 Forecast Type: {results['forecast_type']}")
            print(f"   Horizon: {results.get('horizon_days', args.horizon)} days")
            if 'avg_daily_orders' in results:
                print(f"   Avg Daily Orders: {results['avg_daily_orders']}")
        print("\n" + "="*80)
finally:
    forecaster.disconnect()
