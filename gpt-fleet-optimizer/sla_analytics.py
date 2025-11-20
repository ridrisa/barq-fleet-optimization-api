#!/usr/bin/env python3
"""Simplified SLA Analytics - Production Compatible"""
import os, sys, json, argparse, psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import pandas as pd

class SLAAnalytics:
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
    
    def analyze_compliance(self, date_range=7, hub_id=None):
        print(f"\n📊 Analyzing SLA compliance (last {date_range} days)...")
        query = """
        SELECT 
            order_status,
            COUNT(*) as total_orders,
            COUNT(CASE WHEN delivery_finish IS NOT NULL THEN 1 END) as delivered,
            AVG(
                CASE 
                    WHEN delivery_finish IS NOT NULL AND delivery_start IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (delivery_finish - delivery_start)) / 3600.0
                    ELSE NULL
                END
            ) as avg_delivery_hours
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '{} days'
        {}
        GROUP BY order_status
        ORDER BY total_orders DESC
        """.format(date_range, "AND hub_id = %s" if hub_id else "")
        
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(query, [hub_id] if hub_id else [])
        results = cursor.fetchall()
        cursor.close()
        
        if not results:
            return {"error": "No data available"}
        
        df = pd.DataFrame(results)
        total = df['total_orders'].sum()
        delivered = df['delivered'].sum()
        
        print(f"✓ Analyzed {total} orders")
        return {
            'analysis_type': 'compliance',
            'date_range': date_range,
            'hub_id': hub_id,
            'summary': {
                'total_orders': int(total),
                'delivered_orders': int(delivered),
                'delivery_rate': round(delivered / total * 100, 2) if total > 0 else 0,
                'avg_delivery_hours': round(df['avg_delivery_hours'].mean(), 2)
            },
            'by_status': df.to_dict('records')
        }
    
    def get_realtime_status(self):
        print("\n⚡ Getting real-time SLA status...")
        query = """
        SELECT 
            order_status,
            COUNT(*) as count
        FROM orders
        WHERE created_at >= CURRENT_DATE
        GROUP BY order_status
        """
        
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(query)
        results = cursor.fetchall()
        cursor.close()
        
        if not results:
            return {"error": "No data available"}
        
        df = pd.DataFrame(results)
        print(f"✓ Retrieved real-time status for {df['count'].sum()} orders today")
        return {
            'analysis_type': 'realtime',
            'current_status': df.to_dict('records'),
            'total_today': int(df['count'].sum())
        }

parser = argparse.ArgumentParser()
parser.add_argument('--analysis_type', choices=['compliance', 'realtime', 'performance'], default='compliance')
parser.add_argument('--date_range', type=int, default=7)
parser.add_argument('--hub_id', type=int)
parser.add_argument('--output', choices=['console', 'json'], default='console')
args = parser.parse_args()

analyzer = SLAAnalytics()
analyzer.connect()
try:
    if args.analysis_type == 'realtime':
        results = analyzer.get_realtime_status()
    else:
        results = analyzer.analyze_compliance(args.date_range, args.hub_id)
    
    if args.output == 'json':
        print("\n" + json.dumps(results, indent=2, default=str))
    else:
        print("\n" + "="*80)
        print(f"SLA ANALYTICS: {args.analysis_type.upper()}")
        print("="*80)
        if 'error' in results:
            print(f"\n❌ Error: {results['error']}")
        else:
            print(f"\n📊 Analysis Type: {results['analysis_type']}")
            if 'summary' in results:
                for k, v in results['summary'].items():
                    print(f"   {k}: {v}")
        print("\n" + "="*80)
finally:
    analyzer.disconnect()
