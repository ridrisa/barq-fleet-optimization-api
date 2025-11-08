/**
 * Sentry Configuration for Error Tracking and APM
 * Provides real-time error monitoring and performance tracking
 */

const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');
const { logger } = require('../utils/logger');

/**
 * Initialize Sentry with Express app
 * @param {Object} app - Express application instance
 * @returns {Object} Sentry instance
 */
function initSentry(app) {
  const dsn = process.env.SENTRY_DSN || '';
  const environment = process.env.NODE_ENV || 'development';

  // Only initialize if DSN is provided
  if (!dsn && environment === 'production') {
    logger.warn('Sentry DSN not configured. Error tracking disabled.');
    return null;
  }

  try {
    Sentry.init({
      dsn,
      environment,

      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring
      // In production, adjust this to a lower value (e.g., 0.1 for 10%)
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

      // Set sampling rate for profiling
      profilesSampleRate: environment === 'production' ? 0.1 : 1.0,

      // Performance monitoring integrations
      integrations: [
        // Express integration with tracing
        new Sentry.Integrations.Http({ tracing: true }),
        new Tracing.Integrations.Express({ app }),

        // Additional integrations
        new Sentry.Integrations.OnUncaughtException({
          onFatalError: async (err) => {
            logger.error('Fatal error captured by Sentry', {
              error: err.message,
              stack: err.stack,
            });

            // Allow Sentry to send the event before exiting
            await Sentry.close(2000);
            process.exit(1);
          },
        }),
        new Sentry.Integrations.OnUnhandledRejection({ mode: 'warn' }),
      ],

      // Before send hook to filter/modify events
      beforeSend(event, hint) {
        // Filter out specific errors if needed
        const error = hint.originalException;

        // Don't send 404s to Sentry
        if (event.message && event.message.includes('Not Found')) {
          return null;
        }

        // Don't send validation errors
        if (error && error.name === 'ValidationError') {
          return null;
        }

        // Add additional context
        if (event.request) {
          event.request.env = environment;
        }

        return event;
      },

      // Before breadcrumb hook to filter breadcrumbs
      beforeBreadcrumb(breadcrumb, hint) {
        // Filter out console breadcrumbs in production
        if (breadcrumb.category === 'console' && environment === 'production') {
          return null;
        }

        return breadcrumb;
      },

      // Enable debug mode in development
      debug: environment === 'development',

      // Release tracking (can be set to git commit hash)
      release: process.env.SENTRY_RELEASE || process.env.npm_package_version || '1.0.0',

      // Server name
      serverName: process.env.SERVER_NAME || 'barq-api',

      // Maximum breadcrumbs
      maxBreadcrumbs: 50,

      // Attach stack traces to pure capture message / log integrations
      attachStacktrace: true,
    });

    logger.info('Sentry initialized successfully', {
      environment,
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      dsn: dsn ? 'configured' : 'not configured',
    });

    return Sentry;
  } catch (error) {
    logger.error('Failed to initialize Sentry', { error: error.message });
    return null;
  }
}

/**
 * Create a custom transaction for monitoring
 * @param {string} operation - Operation type (e.g., 'http.request', 'optimization')
 * @param {string} name - Transaction name
 * @param {Function} callback - Async function to execute within transaction
 * @returns {Promise<any>} Result of callback
 */
async function withTransaction(operation, name, callback) {
  const transaction = Sentry.startTransaction({
    op: operation,
    name,
  });

  try {
    const result = await callback(transaction);
    transaction.setStatus('ok');
    return result;
  } catch (error) {
    transaction.setStatus('internal_error');
    Sentry.captureException(error);
    throw error;
  } finally {
    transaction.finish();
  }
}

/**
 * Create a span within current transaction
 * @param {Object} transaction - Parent transaction
 * @param {string} operation - Operation type
 * @param {string} description - Span description
 * @param {Function} callback - Async function to execute within span
 * @returns {Promise<any>} Result of callback
 */
async function withSpan(transaction, operation, description, callback) {
  const span = transaction.startChild({
    op: operation,
    description,
  });

  try {
    const result = await callback(span);
    span.setStatus('ok');
    return result;
  } catch (error) {
    span.setStatus('internal_error');
    throw error;
  } finally {
    span.finish();
  }
}

/**
 * Add breadcrumb for tracking user actions
 * @param {string} message - Breadcrumb message
 * @param {string} category - Category (e.g., 'auth', 'optimization')
 * @param {string} level - Level (info, warning, error)
 * @param {Object} data - Additional data
 */
function addBreadcrumb(message, category = 'action', level = 'info', data = {}) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for better error tracking
 * @param {Object} user - User object with id, email, etc.
 */
function setUserContext(user) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
      organizationId: user.organizationId,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Set custom tags for filtering errors
 * @param {Object} tags - Key-value pairs
 */
function setTags(tags) {
  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value);
  });
}

/**
 * Set additional context
 * @param {string} name - Context name
 * @param {Object} context - Context data
 */
function setContext(name, context) {
  Sentry.setContext(name, context);
}

/**
 * Capture exception manually
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function captureException(error, context = {}) {
  Sentry.captureException(error, {
    contexts: context,
  });
}

/**
 * Capture message manually
 * @param {string} message - Message to capture
 * @param {string} level - Severity level
 * @param {Object} context - Additional context
 */
function captureMessage(message, level = 'info', context = {}) {
  Sentry.captureMessage(message, {
    level,
    contexts: context,
  });
}

module.exports = {
  initSentry,
  Sentry,
  withTransaction,
  withSpan,
  addBreadcrumb,
  setUserContext,
  setTags,
  setContext,
  captureException,
  captureMessage,
};
