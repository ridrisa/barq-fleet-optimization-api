/**
 * WebSocket Agent Monitor Service
 * Provides real-time agent monitoring and updates via WebSocket
 */

const WebSocket = require('ws');
const { logger } = require('../utils/logger');
const EventEmitter = require('events');

class WebSocketAgentMonitor extends EventEmitter {
  constructor(server, agentManager) {
    super();
    
    this.server = server;
    this.agentManager = agentManager;
    this.wss = null;
    this.clients = new Map(); // Map<clientId, {ws, subscriptions, metadata}>
    this.rooms = new Map(); // Map<roomName, Set<clientId>>
    
    // Configuration
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      maxClients: 100,
      pingTimeout: 60000, // 1 minute
      authTimeout: 10000, // 10 seconds
    };
    
    this.isRunning = false;
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
    };
    
    logger.info('[WebSocketAgentMonitor] Service initialized');
  }

  /**
   * Start the WebSocket server
   */
  start() {
    if (this.isRunning) {
      logger.warn('[WebSocketAgentMonitor] Server already running');
      return;
    }

    try {
      // Create WebSocket server
      this.wss = new WebSocket.Server({
        server: this.server,
        path: '/ws/agents',
        verifyClient: (info) => this.verifyClient(info),
      });

      // Set up WebSocket event handlers
      this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
      this.wss.on('error', (error) => this.handleServerError(error));

      // Set up agent manager event listeners
      this.setupAgentManagerListeners();

      // Start heartbeat mechanism
      this.startHeartbeat();

      this.isRunning = true;
      logger.info('[WebSocketAgentMonitor] WebSocket server started on /ws/agents');

      this.emit('started');
    } catch (error) {
      logger.error('[WebSocketAgentMonitor] Failed to start server', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop heartbeat
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }

      // Close all client connections
      this.clients.forEach((client, clientId) => {
        this.disconnectClient(clientId, 'Server shutting down');
      });

      // Close server
      if (this.wss) {
        this.wss.close();
      }

      // Remove agent manager listeners
      this.removeAgentManagerListeners();

      this.isRunning = false;
      logger.info('[WebSocketAgentMonitor] WebSocket server stopped');

      this.emit('stopped');
    } catch (error) {
      logger.error('[WebSocketAgentMonitor] Error stopping server', { error: error.message });
    }
  }

  /**
   * Verify client connection
   */
  verifyClient(info) {
    // Check if we're at max capacity
    if (this.clients.size >= this.config.maxClients) {
      logger.warn('[WebSocketAgentMonitor] Connection rejected: max clients reached');
      return false;
    }

    // Add additional verification logic here (authentication, rate limiting, etc.)
    return true;
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws,
      subscriptions: new Set(),
      metadata: {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        connectedAt: Date.now(),
        lastPing: Date.now(),
        authenticated: false,
        userId: null,
        role: null,
      },
    };

    this.clients.set(clientId, clientInfo);
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    logger.info('[WebSocketAgentMonitor] New client connected', {
      clientId,
      ip: clientInfo.metadata.ip,
      totalClients: this.clients.size,
    });

    // Set up client event handlers
    ws.on('message', (data) => this.handleClientMessage(clientId, data));
    ws.on('close', (code, reason) => this.handleClientDisconnect(clientId, code, reason));
    ws.on('error', (error) => this.handleClientError(clientId, error));
    ws.on('pong', () => this.handleClientPong(clientId));

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'welcome',
      clientId,
      timestamp: Date.now(),
      config: {
        heartbeatInterval: this.config.heartbeatInterval,
        authRequired: true,
      },
    });

    // Set authentication timeout
    setTimeout(() => {
      const client = this.clients.get(clientId);
      if (client && !client.metadata.authenticated) {
        this.disconnectClient(clientId, 'Authentication timeout');
      }
    }, this.config.authTimeout);

    this.emit('clientConnected', { clientId, metadata: clientInfo.metadata });
  }

  /**
   * Handle client message
   */
  handleClientMessage(clientId, data) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (error) {
        this.sendError(clientId, 'Invalid JSON format');
        return;
      }

      this.stats.messagesReceived++;

      // Handle different message types
      switch (message.type) {
        case 'auth':
          this.handleAuthentication(clientId, message);
          break;
          
        case 'subscribe':
          this.handleSubscription(clientId, message);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscription(clientId, message);
          break;
          
        case 'ping':
          this.handlePing(clientId, message);
          break;
          
        case 'getAgentStatus':
          this.handleGetAgentStatus(clientId, message);
          break;
          
        case 'getSystemMetrics':
          this.handleGetSystemMetrics(clientId, message);
          break;
          
        default:
          this.sendError(clientId, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('[WebSocketAgentMonitor] Error handling client message', {
        clientId,
        error: error.message,
      });
      this.stats.errors++;
    }
  }

  /**
   * Handle client authentication
   */
  handleAuthentication(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // TODO: Implement proper JWT token validation
    // For now, accept any token for demo purposes
    const { token, userId, role } = message.data || {};
    
    if (!token) {
      this.sendError(clientId, 'Authentication token required');
      return;
    }

    // Simulate token validation
    client.metadata.authenticated = true;
    client.metadata.userId = userId || 'demo-user';
    client.metadata.role = role || 'viewer';

    this.sendToClient(clientId, {
      type: 'authSuccess',
      data: {
        authenticated: true,
        userId: client.metadata.userId,
        role: client.metadata.role,
      },
      timestamp: Date.now(),
    });

    logger.info('[WebSocketAgentMonitor] Client authenticated', {
      clientId,
      userId: client.metadata.userId,
      role: client.metadata.role,
    });
  }

  /**
   * Handle subscription request
   */
  handleSubscription(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || !client.metadata.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    const { topics } = message.data || {};
    if (!Array.isArray(topics)) {
      this.sendError(clientId, 'Topics must be an array');
      return;
    }

    const validTopics = [
      'agent.*.status',
      'agent.*.metrics',
      'agent.*.logs',
      'system.alerts',
      'system.metrics',
      'system.health',
    ];

    const subscribedTopics = [];
    topics.forEach(topic => {
      if (this.isValidTopic(topic, validTopics)) {
        client.subscriptions.add(topic);
        subscribedTopics.push(topic);
        
        // Join room for this topic
        this.joinRoom(clientId, topic);
      }
    });

    this.sendToClient(clientId, {
      type: 'subscribed',
      data: {
        topics: subscribedTopics,
        total: client.subscriptions.size,
      },
      timestamp: Date.now(),
    });

    logger.info('[WebSocketAgentMonitor] Client subscribed', {
      clientId,
      topics: subscribedTopics,
    });
  }

  /**
   * Handle unsubscription request
   */
  handleUnsubscription(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { topics } = message.data || {};
    if (!Array.isArray(topics)) {
      this.sendError(clientId, 'Topics must be an array');
      return;
    }

    const unsubscribedTopics = [];
    topics.forEach(topic => {
      if (client.subscriptions.has(topic)) {
        client.subscriptions.delete(topic);
        unsubscribedTopics.push(topic);
        
        // Leave room for this topic
        this.leaveRoom(clientId, topic);
      }
    });

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      data: {
        topics: unsubscribedTopics,
        remaining: client.subscriptions.size,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle ping message
   */
  handlePing(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.metadata.lastPing = Date.now();
    
    this.sendToClient(clientId, {
      type: 'pong',
      data: message.data,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle get agent status request
   */
  handleGetAgentStatus(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || !client.metadata.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    try {
      const { agentId } = message.data || {};
      
      if (agentId) {
        const status = this.agentManager.getAgentStatus(agentId);
        this.sendToClient(clientId, {
          type: 'agentStatus',
          data: { agentId, status },
          timestamp: Date.now(),
        });
      } else {
        const statuses = this.agentManager.getAllAgentStatus();
        this.sendToClient(clientId, {
          type: 'allAgentStatuses',
          data: statuses,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      this.sendError(clientId, `Failed to get agent status: ${error.message}`);
    }
  }

  /**
   * Handle get system metrics request
   */
  handleGetSystemMetrics(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || !client.metadata.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    try {
      const metrics = this.agentManager.getSystemMetrics();
      this.sendToClient(clientId, {
        type: 'systemMetrics',
        data: metrics,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.sendError(clientId, `Failed to get system metrics: ${error.message}`);
    }
  }

  /**
   * Handle client disconnect
   */
  handleClientDisconnect(clientId, code, reason) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all rooms
    client.subscriptions.forEach(topic => {
      this.leaveRoom(clientId, topic);
    });

    // Remove client
    this.clients.delete(clientId);
    this.stats.activeConnections--;

    logger.info('[WebSocketAgentMonitor] Client disconnected', {
      clientId,
      code,
      reason: reason?.toString(),
      totalClients: this.clients.size,
    });

    this.emit('clientDisconnected', { clientId, code, reason });
  }

  /**
   * Handle client error
   */
  handleClientError(clientId, error) {
    logger.error('[WebSocketAgentMonitor] Client error', {
      clientId,
      error: error.message,
    });
    this.stats.errors++;
  }

  /**
   * Handle client pong
   */
  handleClientPong(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.metadata.lastPing = Date.now();
    }
  }

  /**
   * Handle server error
   */
  handleServerError(error) {
    logger.error('[WebSocketAgentMonitor] Server error', { error: error.message });
    this.stats.errors++;
  }

  /**
   * Set up agent manager event listeners
   */
  setupAgentManagerListeners() {
    this.agentManager.on('agentStarted', (data) => {
      this.broadcast('agent.status', {
        type: 'agentStarted',
        agentName: data.agentName,
        timestamp: data.timestamp,
      });
    });

    this.agentManager.on('agentStopped', (data) => {
      this.broadcast('agent.status', {
        type: 'agentStopped',
        agentName: data.agentName,
        timestamp: data.timestamp,
      });
    });

    this.agentManager.on('agentRestarted', (data) => {
      this.broadcast('agent.status', {
        type: 'agentRestarted',
        agentName: data.agentName,
        timestamp: data.timestamp,
      });
    });

    this.agentManager.on('agentLog', (data) => {
      this.broadcast(`agent.${data.agentName}.logs`, {
        type: 'agentLog',
        agentName: data.agentName,
        logEntry: data.logEntry,
      });
    });

    this.agentManager.on('agentMetricsUpdated', (data) => {
      this.broadcast(`agent.${data.agentName}.metrics`, {
        type: 'agentMetrics',
        agentName: data.agentName,
        metrics: data.metrics,
      });
    });

    this.agentManager.on('mode-changed', (mode) => {
      this.broadcast('system.alerts', {
        type: 'modeChanged',
        mode,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Remove agent manager event listeners
   */
  removeAgentManagerListeners() {
    this.agentManager.removeAllListeners();
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      
      this.clients.forEach((client, clientId) => {
        // Check if client has been inactive for too long
        if (now - client.metadata.lastPing > this.config.pingTimeout) {
          this.disconnectClient(clientId, 'Ping timeout');
          return;
        }

        // Send ping
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      this.stats.messagesSent++;
      return true;
    } catch (error) {
      logger.error('[WebSocketAgentMonitor] Failed to send message to client', {
        clientId,
        error: error.message,
      });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Send error message to client
   */
  sendError(clientId, errorMessage) {
    this.sendToClient(clientId, {
      type: 'error',
      data: { message: errorMessage },
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast message to all subscribers of a topic
   */
  broadcast(topic, message) {
    const room = this.rooms.get(topic);
    if (!room) return 0;

    let sentCount = 0;
    room.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && this.isSubscribedToTopic(client, topic)) {
        if (this.sendToClient(clientId, {
          type: 'broadcast',
          topic,
          data: message,
          timestamp: Date.now(),
        })) {
          sentCount++;
        }
      }
    });

    return sentCount;
  }

  /**
   * Disconnect a client
   */
  disconnectClient(clientId, reason) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      client.ws.close(1000, reason);
    } catch (error) {
      logger.error('[WebSocketAgentMonitor] Error disconnecting client', {
        clientId,
        error: error.message,
      });
    }
  }

  /**
   * Join a room (topic subscription)
   */
  joinRoom(clientId, topic) {
    if (!this.rooms.has(topic)) {
      this.rooms.set(topic, new Set());
    }
    this.rooms.get(topic).add(clientId);
  }

  /**
   * Leave a room (topic unsubscription)
   */
  leaveRoom(clientId, topic) {
    const room = this.rooms.get(topic);
    if (room) {
      room.delete(clientId);
      if (room.size === 0) {
        this.rooms.delete(topic);
      }
    }
  }

  /**
   * Check if client is subscribed to topic
   */
  isSubscribedToTopic(client, topic) {
    for (const subscription of client.subscriptions) {
      if (this.matchesTopic(subscription, topic)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a topic matches a subscription pattern
   */
  matchesTopic(pattern, topic) {
    const patternParts = pattern.split('.');
    const topicParts = topic.split('.');

    if (patternParts.length !== topicParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] !== '*' && patternParts[i] !== topicParts[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if topic is valid
   */
  isValidTopic(topic, validTopics) {
    return validTopics.some(validTopic => this.matchesTopic(validTopic, topic));
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeClients: this.clients.size,
      totalRooms: this.rooms.size,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
    };
  }

  /**
   * Get connected clients info
   */
  getClients() {
    const clients = [];
    this.clients.forEach((client, clientId) => {
      clients.push({
        id: clientId,
        ip: client.metadata.ip,
        connectedAt: client.metadata.connectedAt,
        authenticated: client.metadata.authenticated,
        userId: client.metadata.userId,
        role: client.metadata.role,
        subscriptions: Array.from(client.subscriptions),
        lastPing: client.metadata.lastPing,
      });
    });
    return clients;
  }
}

module.exports = WebSocketAgentMonitor;