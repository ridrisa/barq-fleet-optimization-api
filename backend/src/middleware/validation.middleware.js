/**
 * Validation Middleware
 * Request validation using Joi schemas
 */

const schemas = require('../validation/schemas');
const { logger } = require('../utils/logger');

/**
 * Validate request against a schema
 * @param {string} schemaName - Name of the schema to validate against
 * @param {string} source - Source of data to validate ('body', 'query', 'params')
 */
const validate = (schemaName, source = 'body') => {
  return (req, res, next) => {
    const schema = schemas[schemaName];

    if (!schema) {
      logger.error('[Validation] Schema not found', { schemaName });
      return res.status(500).json({
        success: false,
        error: 'Validation configuration error',
      });
    }

    const dataToValidate = req[source];
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type,
      }));

      logger.warn('[Validation] Validation failed', {
        requestId: req.headers['x-request-id'],
        schemaName,
        errors,
        ip: req.ip,
        path: req.originalUrl,
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    // Replace request data with validated and sanitized data
    req[source] = value;

    logger.debug('[Validation] Validation passed', {
      requestId: req.headers['x-request-id'],
      schemaName,
      source,
    });

    next();
  };
};

/**
 * Sanitize string to prevent XSS
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;

  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Recursively sanitize object
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'string') {
        sanitized[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object') {
        sanitized[key] = sanitizeObject(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
  }

  return sanitized;
};

/**
 * Sanitize request data middleware
 */
const sanitizeRequest = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * Validate file upload
 * @param {Object} options - Validation options
 * @param {Array<string>} options.allowedTypes - Allowed MIME types
 * @param {number} options.maxSize - Maximum file size in bytes
 */
const validateFileUpload = (options = {}) => {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    maxSize = 5 * 1024 * 1024, // 5MB default
  } = options;

  return (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files || [req.file];

    for (const file of files) {
      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        logger.warn('[Validation] Invalid file type', {
          requestId: req.headers['x-request-id'],
          mimetype: file.mimetype,
          allowedTypes,
        });

        return res.status(400).json({
          success: false,
          error: `File type ${file.mimetype} is not allowed`,
        });
      }

      // Check file size
      if (file.size > maxSize) {
        logger.warn('[Validation] File too large', {
          requestId: req.headers['x-request-id'],
          size: file.size,
          maxSize,
        });

        return res.status(400).json({
          success: false,
          error: `File size exceeds maximum allowed size of ${maxSize} bytes`,
        });
      }
    }

    next();
  };
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  if (page < 1) {
    return res.status(400).json({
      success: false,
      error: 'Page must be greater than 0',
    });
  }

  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      error: 'Limit must be between 1 and 100',
    });
  }

  req.pagination = {
    page,
    limit,
    offset: (page - 1) * limit,
  };

  next();
};

module.exports = {
  validate,
  sanitizeString,
  sanitizeObject,
  sanitizeRequest,
  validateFileUpload,
  validatePagination,
};
