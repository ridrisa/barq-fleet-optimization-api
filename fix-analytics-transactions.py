#!/usr/bin/env python3
"""
Fix transaction handling in analytics Python files.
Adds proper rollback statements to all except blocks.
"""

import re
import os

files_to_fix = [
    'gpt-fleet-optimizer/sla_analytics.py',
    'gpt-fleet-optimizer/fleet_performance.py',
    'gpt-fleet-optimizer/route_analyzer.py',
    'gpt-fleet-optimizer/demand_forecaster.py'
]

def fix_file(filepath):
    """Add rollback to except blocks that interact with database."""

    if not os.path.exists(filepath):
        print(f"❌ File not found: {filepath}")
        return False

    with open(filepath, 'r') as f:
        content = f.read()

    # Pattern to find except blocks that follow cursor.execute
    # We'll add rollback after "except Exception as e:"

    # Simple approach: add rollback after every "except Exception as e:" that follows a try block with cursor.execute
    lines = content.split('\n')
    new_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]
        new_lines.append(line)

        # Check if this is an except line
        if 'except Exception as e:' in line:
            # Get the indentation
            indent = len(line) - len(line.lstrip())
            # Look back to see if there was a cursor.execute in the try block
            has_db_operation = False
            for j in range(max(0, i-50), i):
                if 'cursor.execute' in lines[j] or 'cursor =' in lines[j]:
                    has_db_operation = True
                    break

            if has_db_operation:
                # Add rollback right after the except line
                i += 1
                if i < len(lines):
                    next_line = lines[i]
                    # Check if rollback is already there
                    if 'rollback()' not in next_line:
                        # Add rollback
                        rollback_line = ' ' * (indent + 4) + 'if self.conn:'
                        new_lines.append(rollback_line)
                        rollback_line = ' ' * (indent + 8) + 'self.conn.rollback()'
                        new_lines.append(rollback_line)
                    new_lines.append(next_line)
                continue

        i += 1

    new_content = '\n'.join(new_lines)

    # Write back
    backup_file = filepath + '.backup'
    os.rename(filepath, backup_file)

    with open(filepath, 'w') as f:
        f.write(new_content)

    print(f"✅ Fixed {filepath}")
    print(f"   Backup saved to: {backup_file}")
    return True

if __name__ == '__main__':
    print("🔧 Fixing transaction handling in analytics files...\n")

    success_count = 0
    for filepath in files_to_fix:
        if fix_file(filepath):
            success_count += 1

    print(f"\n✅ Successfully fixed {success_count}/{len(files_to_fix)} files")
