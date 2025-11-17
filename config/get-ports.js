#!/usr/bin/env node

/**
 * Dynamic Port Configuration Loader
 * Ensures frontend and backend ports stay synchronized
 */

const fs = require('fs');
const path = require('path');

// Load port configuration
const portsConfig = require('./ports.json');

// Get environment (default to development)
const env = process.env.NODE_ENV || 'development';

// Get specific service from command line argument
const service = process.argv[2];

// Get ports for current environment
const ports = portsConfig[env] || portsConfig.development;

if (service) {
  // Return specific service port
  console.log(ports[service]);
} else {
  // Return all ports as environment variables
  console.log(`BACKEND_PORT=${ports.backend}`);
  console.log(`FRONTEND_PORT=${ports.frontend}`);
  console.log(`WEBSOCKET_PORT=${ports.websocket}`);
  console.log(`ANALYTICS_PORT=${ports.analytics}`);
  console.log(`CVRP_PORT=${ports.cvrp}`);
}

// Export for use in other scripts
module.exports = {
  getPorts: (environment = env) => {
    return portsConfig[environment] || portsConfig.development;
  },
  getPort: (service, environment = env) => {
    const envPorts = portsConfig[environment] || portsConfig.development;
    return envPorts[service];
  }
};