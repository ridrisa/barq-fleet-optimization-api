#!/usr/bin/env node
/**
 * Data Migration Script
 * Migrates data from LowDB (db.json) to PostgreSQL
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const postgresService = require('../src/services/postgres.service');

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

async function migrateData() {
  try {
    log('=== Data Migration: LowDB to PostgreSQL ===', 'blue');
    log('');

    // Initialize PostgreSQL connection
    log('Initializing PostgreSQL connection...', 'yellow');
    await postgresService.initialize();
    log('✓ PostgreSQL connected', 'green');

    // Read db.json
    const dbPath = path.join(__dirname, '../src/db/db.json');
    log(`\nReading data from: ${dbPath}`, 'yellow');

    if (!fs.existsSync(dbPath)) {
      throw new Error(`db.json not found at: ${dbPath}`);
    }

    const rawData = fs.readFileSync(dbPath, 'utf8');
    const data = JSON.parse(rawData);
    log('✓ Data loaded from db.json', 'green');

    const stats = {
      requests: 0,
      optimizations: 0,
      metrics: 0,
      errors: []
    };

    // Migrate Optimization Requests
    log('\n--- Migrating Optimization Requests ---', 'blue');
    const requests = data.requests || [];
    log(`Found ${requests.length} requests to migrate`, 'yellow');

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];

      try {
        // Transform LowDB format to PostgreSQL format
        const pgRequest = {
          id: request.id || request.requestId,
          request_id: request.id || request.requestId,
          status: request.status || 'completed',
          pickup_points: request.pickupPoints || [],
          delivery_points: request.deliveryPoints || [],
          fleet: request.fleet || [],
          business_rules: request.businessRules || {},
          preferences: request.preferences || {},
          context: request.context || {},
          timestamp: request.timestamp || new Date().toISOString(),
          metadata: {
            source: 'lowdb_migration',
            migrated_at: new Date().toISOString(),
            original_id: request.id
          }
        };

        await postgresService.createOptimizationRequest(pgRequest);
        stats.requests++;

        if ((i + 1) % 100 === 0) {
          log(`  Migrated ${i + 1}/${requests.length} requests...`, 'yellow');
        }
      } catch (error) {
        stats.errors.push({
          type: 'request',
          id: request.id,
          error: error.message
        });
        log(`  ✗ Failed to migrate request ${request.id}: ${error.message}`, 'red');
      }
    }

    log(`✓ Migrated ${stats.requests} optimization requests`, 'green');

    // Migrate Optimization Results
    log('\n--- Migrating Optimization Results ---', 'blue');
    const optimizations = data.optimizations || [];
    log(`Found ${optimizations.length} optimization results to migrate`, 'yellow');

    for (let i = 0; i < optimizations.length; i++) {
      const optimization = optimizations[i];

      try {
        const pgOptimization = {
          request_id: optimization.requestId || optimization.request_id,
          optimization_id: optimization.id || uuidv4(),
          success: optimization.success !== undefined ? optimization.success : true,
          routes: optimization.routes || [],
          total_distance: optimization.total_distance || 0,
          total_duration: optimization.total_duration || 0,
          total_cost: optimization.total_cost || 0,
          fuel_consumption: optimization.fuel_consumption || 0,
          co2_emissions: optimization.co2_emissions || 0,
          computation_time: optimization.time_taken || optimization.computation_time || 0,
          algorithm_used: optimization.algorithm_used || 'unknown',
          metadata: {
            source: 'lowdb_migration',
            migrated_at: new Date().toISOString(),
            original_data: optimization
          }
        };

        await postgresService.createOptimizationResult(pgOptimization);
        stats.optimizations++;

        if ((i + 1) % 100 === 0) {
          log(`  Migrated ${i + 1}/${optimizations.length} optimizations...`, 'yellow');
        }
      } catch (error) {
        stats.errors.push({
          type: 'optimization',
          id: optimization.id || optimization.requestId,
          error: error.message
        });
        log(`  ✗ Failed to migrate optimization: ${error.message}`, 'red');
      }
    }

    log(`✓ Migrated ${stats.optimizations} optimization results`, 'green');

    // Migrate Metrics
    log('\n--- Migrating Metrics ---', 'blue');
    const metrics = data.metrics || [];
    log(`Found ${metrics.length} metrics to migrate`, 'yellow');

    for (let i = 0; i < metrics.length; i++) {
      const metric = metrics[i];

      try {
        const date = metric.date || new Date().toISOString().split('T')[0];

        const pgMetrics = {
          date: date,
          metric_type: 'daily',
          total_requests: metric.total_requests || 0,
          successful_requests: metric.successful_requests || 0,
          failed_requests: metric.failed_requests || 0,
          avg_response_time: metric.avg_response_time || 0,
          avg_route_distance: metric.avg_route_distance || 0,
          avg_route_duration: metric.avg_route_duration || 0,
          total_distance_optimized: metric.total_distance_optimized || 0,
          total_fuel_saved: metric.total_fuel_saved || 0,
          total_co2_reduced: metric.total_co2_reduced || 0,
          sla_compliance_rate: metric.sla_compliance_rate || 100,
          customer_satisfaction: metric.customer_satisfaction || 5.0,
          total_revenue: metric.total_revenue || 0,
          total_cost: metric.total_cost || 0,
          hourly_breakdown: metric.hourly_breakdown || {},
          regional_breakdown: metric.regional_breakdown || {}
        };

        await postgresService.updateMetrics(date, pgMetrics);
        stats.metrics++;

        if ((i + 1) % 10 === 0) {
          log(`  Migrated ${i + 1}/${metrics.length} metrics...`, 'yellow');
        }
      } catch (error) {
        stats.errors.push({
          type: 'metric',
          date: metric.date,
          error: error.message
        });
        log(`  ✗ Failed to migrate metric: ${error.message}`, 'red');
      }
    }

    log(`✓ Migrated ${stats.metrics} metrics`, 'green');

    // Summary
    log('\n=== Migration Complete ===', 'green');
    log('');
    log('Summary:', 'blue');
    log(`  Optimization Requests: ${stats.requests}`, 'green');
    log(`  Optimization Results: ${stats.optimizations}`, 'green');
    log(`  Metrics: ${stats.metrics}`, 'green');

    if (stats.errors.length > 0) {
      log(`\n  Errors: ${stats.errors.length}`, 'red');
      log('\nError Details:', 'red');
      stats.errors.forEach((err, idx) => {
        log(`  ${idx + 1}. [${err.type}] ${err.id || err.date}: ${err.error}`, 'red');
      });
    }

    // Verify migrated data
    log('\n--- Verification ---', 'blue');
    const systemStats = await postgresService.getSystemStats();
    log('Database Statistics:', 'yellow');
    log(`  Total Requests: ${systemStats.total_requests}`, 'blue');
    log(`  Completed Requests: ${systemStats.completed_requests}`, 'blue');
    log(`  Successful Optimizations: ${systemStats.successful_optimizations}`, 'blue');
    log(`  Active Agents: ${systemStats.active_agents}`, 'blue');

    await postgresService.close();

    log('\n✓ Migration completed successfully!', 'green');
    log('');
    log('Next steps:', 'yellow');
    log('1. Update DATABASE_MODE=postgres in your .env file', 'blue');
    log('2. Restart your application', 'blue');
    log('3. Create a backup of db.json (scripts/backup-lowdb.js)', 'blue');
    log('');

  } catch (error) {
    log(`\n✗ Migration failed: ${error.message}`, 'red');
    console.error(error);
    await postgresService.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  migrateData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = migrateData;
