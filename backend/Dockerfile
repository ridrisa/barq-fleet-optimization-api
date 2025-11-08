# Multi-stage Dockerfile for BARQ Fleet Management Backend
# Optimized for production deployment with security and performance best practices

# Stage 1: Dependencies
FROM node:20-alpine AS dependencies

WORKDIR /app

# Install system dependencies for native modules (bcrypt, etc)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (swagger-jsdoc needed at runtime)
RUN npm install && \
    npm cache clean --force

# Stage 2: Builder (for future build steps if needed)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy production dependencies
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# If you need to build TypeScript or other assets, add here
# RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy production dependencies from dependencies stage
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create necessary directories with correct permissions
RUN mkdir -p logs database/migrations database/backups && \
    chown -R nodejs:nodejs logs database

# Set environment variables
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 8080

# Health check - verifies the /health endpoint responds with 200
# Uses PORT environment variable for Cloud Run compatibility
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly (SIGTERM for graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/app.js"]