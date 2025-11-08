/**
 * OSRM Configuration
 * Configuration for the Open Source Routing Machine service
 */

const dotenv = require('dotenv');
dotenv.config();

// OSRM base URL and config
const osrmConfig = {
  // Default OSRM server URL (using public demo server for development)
  baseUrl: process.env.OSRM_BASE_URL || 'https://router.project-osrm.org',

  // Vehicle profiles
  profiles: {
    car: 'car',
    truck: 'driving', // Many OSRM instances use 'driving' for trucks
    bike: 'bike',
    foot: 'foot',
  },

  // OSRM API endpoints
  endpoints: {
    route: '/route/v1/',
    trip: '/trip/v1/',
    table: '/table/v1/',
    match: '/match/v1/',
    nearest: '/nearest/v1/',
  },

  // Default request parameters
  defaultParams: {
    overview: 'full', // Get full route geometry
    alternatives: true, // Get alternative routes
    steps: true, // Get step-by-step instructions
    annotations: true, // Get additional route information
    geometries: 'polyline', // Use polyline encoding for geometries
  },

  // Timeout in milliseconds for OSRM requests
  timeout: 10000,
};

// Helper function to build OSRM URLs
const buildOsrmUrl = (endpoint, profile, coordinates, params = {}) => {
  // Convert coordinates to OSRM format: lng,lat;lng,lat
  const coordString = coordinates.map((coord) => `${coord[1]},${coord[0]}`).join(';');

  // Build the base URL
  const baseUrl = `${osrmConfig.baseUrl}${osrmConfig.endpoints[endpoint]}${osrmConfig.profiles[profile]}/${coordString}`;

  // Add query parameters
  const queryParams = {
    ...osrmConfig.defaultParams,
    ...params,
  };

  const queryString = Object.keys(queryParams)
    .map((key) => `${key}=${queryParams[key]}`)
    .join('&');

  return `${baseUrl}?${queryString}`;
};

module.exports = {
  osrmConfig,
  buildOsrmUrl,
};
