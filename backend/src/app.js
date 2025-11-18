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
const barqProductionRoutes = require('./routes/v1/barq-production.routes');
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

// Application readiness flag (prevents 502 errors during startup)
let isApplicationReady = false;

// Initialize Sentry (must be first)
const sentryInstance = initSentry(app);
if (sentryInstance) {
  // Request handler must be the first middleware
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

// Dynamic port configuration - stays synchronized with frontend
// Load port configuration dynamically to ensure frontend-backend sync
let PORT;
try {
  const portsConfig = require('../../config/ports.json');
  const env = process.env.NODE_ENV || 'development';
  const ports = portsConfig[env] || portsConfig.development;
  PORT = process.env.PORT || ports.backend;
} catch (error) {
  // Fallback if config file doesn't exist
  PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 8080 : 3003);
}

// Trust proxy (required for Cloud Run to properly handle X-Forwarded-* headers)
app.set('trust proxy', true);

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
      const allowedOrigins = process.env.CORS_ORIGIN.split(',').map((o) => o.trim());
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
    'X-API-Version-Preference',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
  ],
  exposedHeaders: ['X-Request-ID', 'X-Total-Count', 'X-Page-Number', 'X-Page-Size'],
  credentials: true,
  maxAge: 86400, // 24 hours - browser caches preflight response
  preflightContinue: false,
  optionsSuccessStatus: 204,
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

// ⚡ READINESS MIDDLEWARE - Prevents 502 errors during startup
// Blocks all requests (except liveness probes) until initialization completes
app.use((req, res, next) => {
  // Always allow liveness probes (Cloud Run requirement)
  if (req.path === '/health' || req.path === '/health/live' || req.path.includes('/live')) {
    return next();
  }

  // Block requests if application not ready
  if (!isApplicationReady) {
    logger.warn('[Readiness] Request blocked - initialization in progress', {
      path: req.path,
      method: req.method
    });
    return res.status(503).json({
      error: 'Service Initializing',
      message: 'Application startup in progress. Please retry in a few seconds.',
      status: 'initializing',
      retryAfter: 5
    });
  }

  next();
});

// Parse cookies
app.use(cookieParser());

// Parse JSON bodies (OWASP - A1: Injection - limit body size to prevent DOS)
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sanitize all user input (OWASP - A1: Injection, A7: XSS)
app.use(sanitizeRequest);

// Rate limiter for API routes
// Configurable via environment variables for testing/production
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // Default: 15 minutes
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 100; // Default: 100 requests
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false'; // Default: enabled

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting if disabled via env var
    if (!RATE_LIMIT_ENABLED) return true;
    // Always skip health checks
    if (req.path === '/admin/agents/status') return true;
    return false;
  },
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      requestId: req.headers['x-request-id'],
      ip: req.ip,
      path: req.originalUrl,
      limit: RATE_LIMIT_MAX,
      window: `${RATE_LIMIT_WINDOW_MS / 60000} minutes`,
    });

    return res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later.',
      limit: RATE_LIMIT_MAX,
      window: `${RATE_LIMIT_WINDOW_MS / 60000} minutes`,
    });
  },
});

// Log rate limit configuration
logger.info('Rate limiting configured', {
  enabled: RATE_LIMIT_ENABLED,
  maxRequests: RATE_LIMIT_MAX,
  windowMinutes: RATE_LIMIT_WINDOW_MS / 60000,
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
    websocket: {
      enabled: wss ? true : false,
      endpoint: '/ws',
      clients: wss ? wss.clients.size : 0,
    },
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

// =================================================================
// IMPORTANT: Specific routes must be defined BEFORE wildcard routes
// Order matters: /api/health and /api/version must come before app.use('/api', ...)
// =================================================================

// Health endpoint alias at /api/health (for backward compatibility)
app.get('/api/health', (req, res) => {
  const healthData = {
    success: true,
    status: 'up',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    ready: isApplicationReady,
  };
  res.status(200).json(healthData);
});

// Version endpoint - API version information
app.get('/api/version', (req, res) => {
  res.json({
    success: true,
    version: process.env.npm_package_version || '1.0.0',
    apiVersion: 'v1',
    environment: process.env.NODE_ENV || 'development',
    buildDate: process.env.BUILD_DATE || new Date().toISOString(),
    commit: process.env.GIT_COMMIT || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

// Admin migration routes - Database migrations (MUST be before /api routes to bypass auth)
const adminMigrationsRoutes = require('./routes/admin-migrations');
app.use('/api/admin/migrations', adminMigrationsRoutes);

// API routes - All routes now handled through versioned router
app.use('/api', apiRoutes);

// Root endpoint - API information (must be after /api to avoid conflicts)
app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'BARQ Fleet Management API',
    description: 'Advanced fleet management and route optimization with AI',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      api: '/api',
      health: '/health',
      apiHealth: '/api/health',
      version: '/api/version',
      metrics: '/metrics',
      documentation: '/api-docs',
    },
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
});

// Automation routes (Phase 4)
app.use('/api/v1/automation', automationRoutes);

// BarqFleet Production Database routes
app.use('/api/v1/barq-production', barqProductionRoutes);

// Health route (not versioned - system endpoint)
app.use('/health', healthRoutes);

// Demo routes - Integrated into main server
const demoRoutes = require('./demo/demo-routes');
app.use('/api/demo', demoRoutes);

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

  // Shutdown WebSocket server
  try {
    if (wss) {
      wss.clients.forEach((client) => {
        client.close();
      });
      wss.close(() => {
        logger.info('WebSocket server closed');
      });
    }
  } catch (error) {
    logger.error('Error shutting down WebSocket server', { error: error.message });
  }

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

// Initialize WebSocket server on the same HTTP server (Cloud Run compatible)
let wss = null;
let demoWebSocketServer = null;

const initializeWebSocket = (httpServer) => {
  try {
    const WebSocket = require('ws');

    // Create WebSocket server that shares the HTTP server
    // ONLY handle WebSocket connections at /ws path
    wss = new WebSocket.Server({
      noServer: true  // Don't auto-handle upgrade, we'll do it manually
    });

    // Manually handle upgrade ONLY for /ws path
    httpServer.on('upgrade', (request, socket, head) => {
      // Only handle WebSocket upgrades for /ws path
      if (request.url === '/ws' || request.url.startsWith('/ws?')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        // For any other path, destroy the socket
        socket.destroy();
      }
    });

    // Set up WebSocket connection handler
    wss.on('connection', (ws, req) => {
      logger.debug('New WebSocket connection established');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          logger.debug('WebSocket message received', { type: data.type });

          // Echo back for testing
          ws.send(JSON.stringify({
            type: 'echo',
            data: data,
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          logger.error('Error processing WebSocket message', { error: error.message });
        }
      });

      ws.on('close', () => {
        logger.debug('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { error: error.message });
      });
    });

    logger.info(`WebSocket server initialized on port ${PORT} at /ws`);
    logger.info(`WebSocket server is Cloud Run compatible (shared port)`);
    logger.info('Regular HTTP requests will NOT be affected by WebSocket');

    return true;
  } catch (error) {
    logger.error('Failed to initialize WebSocket server', { error: error.message });
    return false;
  }
};

// Start the server
const server = app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initialize WebSocket server (Cloud Run compatible - same port)
  const wsInitialized = initializeWebSocket(server);
  if (wsInitialized) {
    logger.info('WebSocket server ready for real-time updates');
  } else {
    logger.warn('WebSocket server initialization failed - continuing without WebSocket support');
  }

  // Initialize PostgreSQL service (required for analytics, production metrics, and automation routes)
  logger.info('Initializing PostgreSQL service...');
  try {
    await postgresService.initialize();
    logger.info('PostgreSQL service initialized successfully');

    // Auto-create agent system tables if they don't exist
    logger.info('Ensuring agent system tables exist...');
    try {
      const path = require('path');
      const { runMigration, verifyTables } = require('./utils/migration-runner');
      // Use the alter migration to add missing columns to existing tables
      const migrationPath = path.join(__dirname, '../migrations/20251117_alter_agent_tables.sql');

      // Run the migration
      const migrationResult = await runMigration(postgresService, migrationPath);

      if (migrationResult.success) {
        logger.info('✅ Agent system tables verified/created successfully', {
          statementsExecuted: migrationResult.statementsExecuted,
          tables: migrationResult.tables
        });

        // Verify tables exist
        const requiredTables = ['assignment_logs', 'escalation_logs', 'dispatch_alerts', 'optimization_logs'];
        const verification = await verifyTables(postgresService, requiredTables);

        if (verification.allExist) {
          logger.info('Database tables verified', verification.tables);
        } else {
          logger.warn('Some tables are missing', verification.tables);
        }
      } else {
        logger.warn('Migration completed with errors', {
          executed: migrationResult.statementsExecuted,
          errors: migrationResult.errors.length
        });
      }
    } catch (tableError) {
      logger.error('Could not auto-create agent tables', {
        error: tableError.message,
        stack: tableError.stack,
        type: tableError.constructor.name
      });

      // Continue without failing - tables might already exist
      logger.info('Checking if tables already exist...');
      try {
        const { verifyTables } = require('./utils/migration-runner');
        const requiredTables = ['assignment_logs', 'escalation_logs', 'dispatch_alerts', 'optimization_logs'];
        const verification = await verifyTables(postgresService, requiredTables);

        if (verification.allExist) {
          logger.info('✅ All required tables already exist', verification.tables);
        } else {
          logger.warn('⚠️ Some required tables are missing', verification.tables);
        }
      } catch (verifyError) {
        logger.error('Failed to verify tables', {
          error: verifyError.message
        });
      }
    }
  } catch (dbError) {
    logger.error('Failed to initialize PostgreSQL service', {
      error: dbError.message,
      stack: dbError.stack,
    });
    logger.warn('Analytics and automation features may not work without database connection');
  }

  // Initialize agent system (ALWAYS - agents != autonomous operations)
  logger.info('Initializing agent system...');

  try {
    const initResult = await AgentInitializer.initialize();
    logger.info('Agent system initialized successfully', initResult);

    // Initialize autonomous operations only if not disabled
    if (process.env.DISABLE_AUTONOMOUS_AGENTS === 'true') {
      logger.warn('⚠️  AUTONOMOUS OPERATIONS DISABLED - Agents available but not running autonomously');
      logger.info('Agent APIs available at /api/v1/agents/*');
      logger.info('Route optimization API available at POST /api/optimize');
    } else {
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
    } // Close else block for autonomous operations

    // Initialize Phase 4 Automation Engines only if not disabled
    if (process.env.DISABLE_AUTOMATION === 'true') {
      logger.warn('⚠️  AUTOMATION ENGINES DISABLED - APIs available but engines not running');
      logger.info('Automation endpoints available at /api/v1/automation/* (will return stopped status)');
      // Initialize routes with null engines to prevent 503 errors
      automationRoutes.initializeEngines(null);
    } else {
      logger.info('Initializing Phase 4 automation engines...');
      try {
        const automationResult = await automationInitializer.initialize(
          AgentInitializer.getAgentManager(),
          AgentInitializer.getAgents()
        );

        // ALWAYS initialize routes with engines (even if null) to prevent 503 errors
        automationRoutes.initializeEngines(automationInitializer.getEngines());
        logger.info('Automation routes initialized with available engines');

        if (automationResult.success) {
          if (automationResult.partial) {
            logger.warn('Phase 4 automation engines partially initialized', {
              engines: automationResult.engines,
              errors: automationResult.errors,
            });
            logger.info('Some automation APIs may not be available');
          } else {
            logger.info('Phase 4 automation engines initialized successfully', {
              engines: automationResult.engines,
            });
          }

          logger.info('Automation endpoints:');
          logger.info('  POST /api/v1/automation/start-all - Start all engines');
          logger.info('  POST /api/v1/automation/stop-all - Stop all engines');
          logger.info('  GET  /api/v1/automation/status-all - Get engine status');
          logger.info('  GET  /api/v1/automation/dashboard - Get dashboard data');

          // Auto-start engines by default (now integrated with production data)
          const startResult = await automationInitializer.startAll({
            autoStart: true, // Changed to true to enable automation by default
          });

          if (startResult.autoStart === false) {
            logger.info('⚠️  Automation engines ready but NOT started');
            logger.info('   Use POST /api/v1/automation/start-all to start engines');
          }
        } else {
          logger.error('Phase 4 automation engines initialization failed', {
            engines: automationResult.engines,
            errors: automationResult.errors,
          });
          logger.warn('Automation APIs will return service unavailable errors');
        }
      } catch (automationError) {
        logger.error('Failed to initialize Phase 4 automation engines', {
          error: automationError.message,
          stack: automationError.stack,
        });
        // Still initialize routes with whatever engines are available
        automationRoutes.initializeEngines(automationInitializer.getEngines());
        logger.warn('Server will continue with limited automation functionality');
        logger.info('Agent APIs still available via /api/v1/agents/*');
      }
    } // Close else block for automation engines
  } catch (error) {
    logger.error('Failed to initialize agent system', { error: error.message });
    logger.warn('Server will continue without agent functionality');
  }

  // ⚡ CRITICAL: Mark application as ready
  // This enables the readiness middleware to allow requests through
  isApplicationReady = true;
  logger.info('🚀 APPLICATION READY - Now accepting requests');
  logger.info(`Server fully initialized in ${Math.round(process.uptime())}s`);
});

// Export the app for testing
module.exports = app;
