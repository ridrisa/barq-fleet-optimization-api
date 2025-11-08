/**
 * Database Configuration
 * Sets up lowdb for simple JSON database storage
 */

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

// Ensure the db directory exists
const dbDir = path.join(__dirname, '../db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create db.json if it doesn't exist
const dbPath = path.join(dbDir, 'db.json');
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(
    dbPath,
    JSON.stringify({
      requests: [],
      optimizations: [],
      metrics: [],
    })
  );
}

// Set up the adapter for the database
const adapter = new FileSync(dbPath);
const db = low(adapter);

// Set default data structure
db.defaults({
  requests: [],
  optimizations: [],
  metrics: [],
}).write();

module.exports = db;
