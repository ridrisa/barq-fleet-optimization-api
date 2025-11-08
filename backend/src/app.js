/**
 * AI Logistics Optimization API
 * Express application with detailed logging
 */

// Environment variables
require('dotenv').config();

// Core dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

// Import custom modules
const { logger, morganStream, logRequestResponse } = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const { initSentry, Sentry } = require('./config/sentry.config');
const metricsService = require('./services/metrics.service');
const { sanitizeRequest } = require('./middleware/validation.middleware');
const apiRoutes = require('./routes');
const healthRoutes = require('./routes/v1/health.routes');
const autonomousRoutes = require('./routes/v1/autonomous.routes');
const swaggerConfig = require('./api/swagger');
const AgentInitializer = require('./services/agent-initializer');
const autonomousInitializer = require('./services/autonomous-initializer');
const automationInitializer = require('./services/automation-initializer');
const { healthService } = require('./services/health.service');
const { auditService } = require('./services/audit.service');
const automationRoutes = require('./routes/automation.routes');
const postgresService = require('./services/postgres.service');

// Create Express app
const app = express();

// Initialize Sentry (must be first)
const sentryInstance = initSentry(app);
if (sentryInstance) {
  // Request handler must be the first middleware
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

// Set port
const PORT = process.env.PORT || 3002;

// Add request ID generator middleware
app.use((req, res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  next();
});

// Apply security headers (OWASP - A6: Security Misconfiguration)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// XSS Protection (OWASP - A7: Cross-Site Scripting)
app.use(xss());

// HTTP Parameter Pollution Protection
app.use(hpp());

// Hide Express version
app.disable('x-powered-by');

// Configure CORS - Enhanced for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // If CORS_ORIGIN is set in env, use it (comma-separated list)
    if (process.env.CORS_ORIGIN) {
      const allowedOrigins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }

    // Default: Allow all origins in development
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-API-Key',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-Total-Count',
    'X-Page-Number',
    'X-Page-Size'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours - browser caches preflight response
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Request logging with morgan, using the custom stream that sends to winston
app.use(
  morgan(':remote-addr :method :url :status :res[content-length] - :response-time ms', {
    stream: morganStream,
  })
);

// Detailed request and response logger
app.use(logRequestResponse);

// Metrics tracking middleware
app.use(metricsService.trackHttpRequest());

// Parse cookies
app.use(cookieParser());

// Parse JSON bodies (OWASP - A1: Injection - limit body size to prevent DOS)
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sanitize all user input (OWASP - A1: Injection, A7: XSS)
app.use(sanitizeRequest);

// Rate limiter for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      requestId: req.headers['x-request-id'],
      ip: req.ip,
      path: req.originalUrl,
    });

    return res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later.',
    });
  },
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  logger.debug('Health check request received', {
    requestId: req.headers['x-request-id'],
    ip: req.ip,
  });

  const healthData = {
    status: 'up',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  };

  logger.debug('Health check response', {
    requestId: req.headers['x-request-id'],
    status: healthData.status,
  });

  return res.status(200).json(healthData);
});

// Swagger documentation
const swaggerDocs = swaggerJsdoc(swaggerConfig.options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, swaggerConfig.uiOptions));

// Metrics endpoint for Prometheus scraping
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsService.getContentType());
    const metrics = await metricsService.getMetrics();
    res.end(metrics);
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message });
    res.status(500).end();
  }
});

// API routes - All routes now handled through versioned router
app.use('/api', apiRoutes);

// Automation routes (Phase 4)
app.use('/api/v1/automation', automationRoutes);

// Health route (not versioned - system endpoint)
app.use('/health', healthRoutes);

// 404 handler - must be before error handler
app.use('*', notFoundHandler);

// Sentry error handler - must be before other error handlers
if (sentryInstance) {
  app.use(Sentry.Handlers.errorHandler());
}

// Global error handler - must be last
app.use(errorHandler);

// Graceful shutdown function
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Shutdown automation engines
  try {
    await automationInitializer.shutdown();
    logger.info('Phase 4 automation engines shutdown complete');
  } catch (error) {
    logger.error('Error shutting down automation engines', { error: error.message });
  }

  // Shutdown autonomous operations
  try {
    await autonomousInitializer.shutdown();
    logger.info('Autonomous operations shutdown complete');
  } catch (error) {
    logger.error('Error shutting down autonomous operations', { error: error.message });
  }

  // Shutdown agents
  try {
    await AgentInitializer.shutdown();
    logger.info('Agent system shutdown complete');
  } catch (error) {
    logger.error('Error shutting down agents', { error: error.message });
  }

  // Close database connections
  try {
    await postgresService.close();
    logger.info('PostgreSQL service closed');
  } catch (error) {
    logger.error('Error closing PostgreSQL service', { error: error.message });
  }

  // Close server
  server.close(() => {
    logger.info('HTTP server closed');

    // Exit process
    process.exit(0);
  });

  // Force close if graceful shutdown fails
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000);
};

// Handle process termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.stack });
  // Output detailed information about the error
  console.error('UNCAUGHT EXCEPTION DETAILS:');
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  // Let the process exit so it can be restarted
  setTimeout(() => process.exit(1), 1000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.stack : String(reason),
    promise: String(promise),
  });

  // Log more detailed information about the rejection
  console.error('UNHANDLED PROMISE REJECTION: ', reason);

  // Don't exit the process for now to allow debugging
  // setTimeout(() => process.exit(1), 1000);
});

// Start the server
const server = app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initialize agent system
  if (process.env.DISABLE_AUTONOMOUS_AGENTS === 'true') {
    logger.warn('⚠️  AUTONOMOUS AGENTS DISABLED - Running in API-only mode');
    logger.info('Route optimization API is available at POST /api/optimize');
  } else {
    logger.info('Initializing agent system...');
    try {
      const initResult = await AgentInitializer.initialize();
      logger.info('Agent system initialized successfully', initResult);

      // Initialize autonomous operations using Worker Threads (non-blocking)
      logger.info('Initializing autonomous operations with Worker Threads...');
      try {
        const autonomousResult = await autonomousInitializer.initialize(
          AgentInitializer.getAgentManager(),
          AgentInitializer.getAgents()
        );

      if (autonomousResult.success) {
        logger.info('Autonomous operations initialized successfully', {
          autonomousMode: autonomousResult.autonomousMode,
          cycleInterval: autonomousResult.cycleInterval,
          workerThread: autonomousResult.workerThread,
          mode: autonomousResult.workerThread
            ? 'WORKER_THREAD (non-blocking)'
            : 'MAIN_THREAD (may impact performance)',
        });

        // Initialize routes with services
        autonomousRoutes.init(
          autonomousInitializer.getOrchestrator(),
          autonomousInitializer.getActionAuth(),
          autonomousInitializer
        );

        logger.info('Autonomous routes initialized');
        logger.info('Status endpoint: GET /api/v1/autonomous/status');
      } else {
        logger.warn('Autonomous operations initialization failed', {
          error: autonomousResult.error,
        });
        logger.info('All agent APIs still available via /api/v1/agents/*');
      }
    } catch (autoError) {
      logger.error('Failed to initialize autonomous operations', {
        error: autoError.message,
        stack: autoError.stack,
      });
      logger.warn('Server will continue without autonomous functionality');
      logger.info('All agent APIs still available via /api/v1/agents/*');
    }

      // Initialize PostgreSQL service (required for automation engines)
      logger.info('Initializing PostgreSQL service...');
      try {
        await postgresService.initialize();
        logger.info('PostgreSQL service initialized successfully');
      } catch (dbError) {
        logger.error('Failed to initialize PostgreSQL service', {
          error: dbError.message,
          stack: dbError.stack,
        });
        logger.warn('Automation features may not work without database connection');
      }

      // Initialize Phase 4 Automation Engines
      logger.info('Initializing Phase 4 automation engines...');
      try {
        const automationResult = await automationInitializer.initialize(
          AgentInitializer.getAgentManager(),
          AgentInitializer.getAgents()
        );

        if (automationResult.success) {
          logger.info('Phase 4 automation engines initialized successfully', {
            engines: automationResult.engines,
          });

          // Initialize automation routes with engines
          automationRoutes.initializeEngines(automationInitializer.getEngines());

          logger.info('Automation routes initialized');
          logger.info('Automation endpoints:');
          logger.info('  POST /api/v1/automation/start-all - Start all engines');
          logger.info('  POST /api/v1/automation/stop-all - Stop all engines');
          logger.info('  GET  /api/v1/automation/status-all - Get engine status');
          logger.info('  GET  /api/v1/automation/dashboard - Get dashboard data');

          // Optionally auto-start engines (default: manual start required)
          const startResult = await automationInitializer.startAll({
            autoStart: process.env.AUTO_START_AUTOMATION === 'true',
          });

          if (startResult.autoStart === false) {
            logger.info('⚠️  Automation engines ready but NOT started');
            logger.info('   Use POST /api/v1/automation/start-all to start engines');
          }
        } else {
          logger.warn('Phase 4 automation engines initialization failed', {
            error: automationResult.error,
          });
          logger.info('Automation APIs still available for manual control');
        }
      } catch (automationError) {
        logger.error('Failed to initialize Phase 4 automation engines', {
          error: automationError.message,
          stack: automationError.stack,
        });
        logger.warn('Server will continue without automation functionality');
        logger.info('Agent APIs still available via /api/v1/agents/*');
      }
    } catch (error) {
      logger.error('Failed to initialize agent system', { error: error.message });
      logger.warn('Server will continue without agent functionality');
    }
  }
});

// Export the app for testing
module.exports = app;
