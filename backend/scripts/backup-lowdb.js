#!/usr/bin/env node
/**
 * Backup Script for LowDB data
 * Creates a timestamped backup of db.json before migration
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function backupLowDB() {
  try {
    log('=== LowDB Backup Script ===', 'blue');
    log('');

    const dbPath = path.join(__dirname, '../src/db/db.json');
    const backupDir = path.join(__dirname, '../backups');

    // Check if db.json exists
    if (!fs.existsSync(dbPath)) {
      throw new Error(`db.json not found at: ${dbPath}`);
    }

    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      log('Creating backups directory...', 'yellow');
      fs.mkdirSync(backupDir, { recursive: true });
      log('✓ Backups directory created', 'green');
    }

    // Get file stats
    const stats = fs.statSync(dbPath);
    const fileSize = formatBytes(stats.size);
    log(`Source file: ${dbPath}`, 'blue');
    log(`File size: ${fileSize}`, 'blue');

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                      new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const backupFilename = `db_backup_${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFilename);

    log(`\nCreating backup: ${backupFilename}`, 'yellow');

    // Copy file
    fs.copyFileSync(dbPath, backupPath);

    // Verify backup
    const backupStats = fs.statSync(backupPath);
    if (backupStats.size === stats.size) {
      log('✓ Backup created successfully!', 'green');
      log(`  Location: ${backupPath}`, 'blue');
      log(`  Size: ${formatBytes(backupStats.size)}`, 'blue');

      // Parse and show data summary
      const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      log('\nData Summary:', 'yellow');
      log(`  Requests: ${(data.requests || []).length}`, 'blue');
      log(`  Optimizations: ${(data.optimizations || []).length}`, 'blue');
      log(`  Metrics: ${(data.metrics || []).length}`, 'blue');

      // List existing backups
      log('\nExisting Backups:', 'yellow');
      const backupFiles = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('db_backup_') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (backupFiles.length > 0) {
        backupFiles.forEach((file, idx) => {
          const filePath = path.join(backupDir, file);
          const fileStats = fs.statSync(filePath);
          log(`  ${idx + 1}. ${file} (${formatBytes(fileStats.size)})`, 'blue');
        });

        // Cleanup old backups (keep last 10)
        if (backupFiles.length > 10) {
          log('\nCleaning up old backups (keeping last 10)...', 'yellow');
          const toDelete = backupFiles.slice(10);
          toDelete.forEach(file => {
            fs.unlinkSync(path.join(backupDir, file));
            log(`  Deleted: ${file}`, 'red');
          });
        }
      }

      log('\n✓ Backup process completed!', 'green');
      log('\nYou can now safely proceed with migration:', 'yellow');
      log('  node scripts/migrate-data.js', 'blue');
      log('');

    } else {
      throw new Error('Backup verification failed: file sizes do not match');
    }

  } catch (error) {
    log(`\n✗ Backup failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  backupLowDB()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = backupLowDB;
