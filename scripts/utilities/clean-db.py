#!/usr/bin/env python3
"""
Clean incomplete optimization records from the low-db database.
Removes any requests that don't have corresponding optimization results.
"""

import json
import sys
from datetime import datetime

DB_PATH = 'backend/src/db/db.json'

def main():
    print("Reading database file...")

    # Read the database
    try:
        with open(DB_PATH, 'r') as f:
            db = json.load(f)
    except Exception as e:
        print(f"Error reading database: {e}")
        sys.exit(1)

    # Get counts before cleanup
    requests_before = len(db.get('requests', []))
    optimizations_before = len(db.get('optimizations', []))

    print(f"\nBefore cleanup:")
    print(f"  - Requests: {requests_before}")
    print(f"  - Optimizations: {optimizations_before}")

    # Create a backup first
    backup_path = f'{DB_PATH}.backup.{datetime.now().strftime("%Y%m%d_%H%M%S")}'
    print(f"\nCreating backup at: {backup_path}")

    try:
        with open(backup_path, 'w') as f:
            json.dump(db, f, indent=2)
        print("Backup created successfully")
    except Exception as e:
        print(f"Error creating backup: {e}")
        sys.exit(1)

    # Get all optimization request IDs
    optimization_ids = set(opt.get('requestId') for opt in db.get('optimizations', []))

    # Filter requests to only keep those that have optimization results
    original_requests = db.get('requests', [])
    cleaned_requests = [req for req in original_requests if req.get('id') in optimization_ids]

    # Update the database
    db['requests'] = cleaned_requests

    # Get counts after cleanup
    requests_after = len(db['requests'])
    optimizations_after = len(db.get('optimizations', []))
    removed_count = requests_before - requests_after

    print(f"\nAfter cleanup:")
    print(f"  - Requests: {requests_after}")
    print(f"  - Optimizations: {optimizations_after}")
    print(f"  - Removed: {removed_count} incomplete requests")

    # Write the cleaned database
    if removed_count > 0:
        print(f"\nWriting cleaned database...")
        try:
            with open(DB_PATH, 'w') as f:
                json.dump(db, f, indent=2)
            print("Database cleaned successfully!")
            print(f"\nBackup available at: {backup_path}")
        except Exception as e:
            print(f"Error writing database: {e}")
            print(f"Original data is safe in backup: {backup_path}")
            sys.exit(1)
    else:
        print("\nNo incomplete requests found - database is already clean!")
        print(f"Removing unnecessary backup...")
        import os
        os.remove(backup_path)

    print("\nDone!")

if __name__ == '__main__':
    main()
