/**
 * Migration Runner Utility
 * Properly executes SQL migration files with multiple statements
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * Parse SQL file and split into individual statements
 * @param {string} sql - Raw SQL content
 * @returns {Array<string>} - Array of SQL statements
 */
function parseSQLStatements(sql) {
  // Remove comments and empty lines
  const lines = sql.split('\n');
  const cleanLines = [];
  let inStatement = false;
  let currentStatement = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('--')) {
      continue;
    }

    // Add line to current statement
    currentStatement.push(line);

    // Check if this completes a statement (ends with semicolon)
    if (trimmedLine.endsWith(';')) {
      const statement = currentStatement.join('\n').trim();
      if (statement) {
        cleanLines.push(statement);
      }
      currentStatement = [];
    }
  }

  // Add any remaining statement
  if (currentStatement.length > 0) {
    const statement = currentStatement.join('\n').trim();
    if (statement) {
      cleanLines.push(statement);
    }
  }

  return cleanLines;
}

/**
 * Run a migration file
 * @param {Object} postgresService - PostgreSQL service instance
 * @param {string} migrationPath - Path to migration file
 * @returns {Promise<Object>} - Migration result
 */
async function runMigration(postgresService, migrationPath) {
  const result = {
    success: false,
    statementsExecuted: 0,
    errors: [],
    tables: []
  };

  try {
    // Read migration file
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    const statements = parseSQLStatements(sql);

    logger.info(`Running migration with ${statements.length} statements`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      try {
        // Extract table name if it's a CREATE TABLE statement
        const tableMatch = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          logger.info(`Creating/verifying table: ${tableName}`);
          result.tables.push(tableName);
        }

        await postgresService.query(statement);
        result.statementsExecuted++;

        // Log index creation
        const indexMatch = statement.match(/CREATE INDEX IF NOT EXISTS (\w+)/i);
        if (indexMatch) {
          logger.debug(`Created/verified index: ${indexMatch[1]}`);
        }
      } catch (error) {
        logger.warn(`Statement ${i + 1} failed: ${error.message}`);
        result.errors.push({
          statement: statement.substring(0, 100) + '...',
          error: error.message
        });

        // Continue with other statements unless it's a critical error
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }

    result.success = true;
    logger.info(`Migration completed: ${result.statementsExecuted}/${statements.length} statements executed`);

    // Verify tables were created
    if (result.tables.length > 0) {
      logger.info(`Tables verified: ${result.tables.join(', ')}`);
    }

  } catch (error) {
    logger.error('Migration failed', {
      error: error.message,
      executed: result.statementsExecuted
    });
    result.errors.push({
      general: error.message
    });
  }

  return result;
}

/**
 * Verify that required tables exist
 * @param {Object} postgresService - PostgreSQL service instance
 * @param {Array<string>} tableNames - Array of table names to check
 * @returns {Promise<Object>} - Verification result
 */
async function verifyTables(postgresService, tableNames) {
  const result = {
    allExist: true,
    tables: {}
  };

  for (const tableName of tableNames) {
    try {
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = $1
        )
      `;

      const res = await postgresService.query(query, [tableName]);
      const exists = res.rows[0].exists;

      result.tables[tableName] = exists;
      if (!exists) {
        result.allExist = false;
      }
    } catch (error) {
      logger.error(`Failed to verify table ${tableName}`, error);
      result.tables[tableName] = false;
      result.allExist = false;
    }
  }

  return result;
}

module.exports = {
  parseSQLStatements,
  runMigration,
  verifyTables
};