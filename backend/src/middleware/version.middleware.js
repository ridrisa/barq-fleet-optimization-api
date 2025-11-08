/**
 * API Versioning Middleware
 * Handles version headers, deprecation warnings, and version validation
 */

const { logger } = require('../utils/logger');

/**
 * Current API version
 */
const CURRENT_VERSION = 'v1';

/**
 * Supported API versions
 */
const SUPPORTED_VERSIONS = ['v1'];

/**
 * Deprecated versions with sunset dates
 */
const DEPRECATED_VERSIONS = {
  // Example: 'v0': { sunsetDate: '2025-12-31', message: 'Please migrate to v1' }
};

/**
 * Add version headers to all responses
 */
const addVersionHeaders = (req, res, next) => {
  // Set current API version header
  res.setHeader('X-API-Version', CURRENT_VERSION);

  // Set supported versions header
  res.setHeader('X-API-Versions-Supported', SUPPORTED_VERSIONS.join(', '));

  // Extract version from request path
  const requestedVersion = extractVersionFromPath(req.path);

  // Check if version is deprecated
  if (requestedVersion && DEPRECATED_VERSIONS[requestedVersion]) {
    const deprecationInfo = DEPRECATED_VERSIONS[requestedVersion];
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Sunset-Date', deprecationInfo.sunsetDate);
    res.setHeader(
      'Warning',
      `299 - "API version ${requestedVersion} is deprecated. ${deprecationInfo.message}"`
    );

    logger.warn('Deprecated API version accessed', {
      version: requestedVersion,
      path: req.path,
      ip: req.ip,
      requestId: req.headers['x-request-id'],
    });
  }

  next();
};

/**
 * Validate API version
 */
const validateVersion = (req, res, next) => {
  const requestedVersion = extractVersionFromPath(req.path);

  // If no version in path, it's using backward compatibility route
  if (!requestedVersion) {
    return next();
  }

  // Check if version is supported
  if (!SUPPORTED_VERSIONS.includes(requestedVersion)) {
    logger.warn('Unsupported API version requested', {
      version: requestedVersion,
      path: req.path,
      ip: req.ip,
      requestId: req.headers['x-request-id'],
    });

    return res.status(400).json({
      success: false,
      error: `API version '${requestedVersion}' is not supported`,
      supportedVersions: SUPPORTED_VERSIONS,
      currentVersion: CURRENT_VERSION,
    });
  }

  next();
};

/**
 * Extract version from request path
 * @param {string} path - Request path
 * @returns {string|null} - Version string or null
 */
const extractVersionFromPath = (path) => {
  const versionMatch = path.match(/\/api\/(v\d+)\//);
  return versionMatch ? versionMatch[1] : null;
};

/**
 * Log version usage for analytics
 */
const logVersionUsage = (req, res, next) => {
  const version = extractVersionFromPath(req.path) || 'unversioned';

  // Add version to request object for later use
  req.apiVersion = version;

  // Log version usage
  logger.debug('API version usage', {
    version,
    path: req.path,
    method: req.method,
    ip: req.ip,
    requestId: req.headers['x-request-id'],
  });

  next();
};

/**
 * Get version information
 */
const getVersionInfo = () => {
  return {
    currentVersion: CURRENT_VERSION,
    supportedVersions: SUPPORTED_VERSIONS,
    deprecatedVersions: Object.keys(DEPRECATED_VERSIONS).map((version) => ({
      version,
      sunsetDate: DEPRECATED_VERSIONS[version].sunsetDate,
      message: DEPRECATED_VERSIONS[version].message,
    })),
  };
};

module.exports = {
  addVersionHeaders,
  validateVersion,
  logVersionUsage,
  extractVersionFromPath,
  getVersionInfo,
  CURRENT_VERSION,
  SUPPORTED_VERSIONS,
  DEPRECATED_VERSIONS,
};
