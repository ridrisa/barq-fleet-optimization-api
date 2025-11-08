# Multi-stage Dockerfile for BARQ Logistics System

# ============================================
# Stage 1: Backend Builder
# ============================================
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

# Copy package files
COPY backend/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy backend source
COPY backend/ ./

# ============================================
# Stage 2: Frontend Builder
# ============================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# ============================================
# Stage 3: Production Image
# ============================================
FROM node:18-alpine

# Install required packages
RUN apk add --no-cache \
    postgresql-client \
    curl \
    tzdata

# Set timezone
ENV TZ=Asia/Riyadh
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create app directory
WORKDIR /app

# Copy backend from builder
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend ./backend

# Copy frontend build
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/public ./frontend/public
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/package.json ./frontend/package.json
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/node_modules ./frontend/node_modules

# Create necessary directories
RUN mkdir -p /app/logs && \
    mkdir -p /app/uploads && \
    chown -R nodejs:nodejs /app/logs && \
    chown -R nodejs:nodejs /app/uploads

# Switch to nodejs user
USER nodejs

# Environment variables
ENV NODE_ENV=production \
    PORT=3002 \
    FRONTEND_PORT=3000 \
    WS_PORT=8081

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose ports
EXPOSE 3000 3002 8081

# Start script
COPY --chown=nodejs:nodejs docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]