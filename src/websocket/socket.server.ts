import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import logger from '../config/logger';
import eventBus from '../events';

interface AuthenticatedSocket extends Socket {
  tenantId?: string;
  userId?: string;
}

class WebSocketServer {
  private io: SocketIOServer;
  private tenantRooms: Map<string, Set<string>> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
      },
      path: '/socket.io',
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupEventBusListeners();

    logger.info('WebSocket server initialized');
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        // Verify JWT token (simplified - use actual JWT verification)
        // const decoded = await verifyToken(token);
        // socket.tenantId = decoded.tenantId;
        // socket.userId = decoded.userId;

        // For now, accept any token (remove in production)
        socket.tenantId = socket.handshake.auth.tenantId;
        socket.userId = socket.handshake.auth.userId;

        if (!socket.tenantId) {
          return next(new Error('Authentication error: Invalid token'));
        }

        next();
      } catch (error) {
        logger.error('WebSocket authentication error', { error });
        next(new Error('Authentication error'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info('Client connected', { socketId: socket.id, tenantId: socket.tenantId });

      // Join tenant room
      if (socket.tenantId) {
        socket.join(`tenant:${socket.tenantId}`);
        this.addToTenantRoom(socket.tenantId, socket.id);
      }

      // Handle custom events
      socket.on('join:campaign', (campaignId: string) => {
        socket.join(`campaign:${campaignId}`);
        logger.info('Client joined campaign room', { socketId: socket.id, campaignId });
      });

      socket.on('leave:campaign', (campaignId: string) => {
        socket.leave(`campaign:${campaignId}`);
        logger.info('Client left campaign room', { socketId: socket.id, campaignId });
      });

      socket.on('join:call', (callId: string) => {
        socket.join(`call:${callId}`);
        logger.info('Client joined call room', { socketId: socket.id, callId });
      });

      socket.on('leave:call', (callId: string) => {
        socket.leave(`call:${callId}`);
        logger.info('Client left call room', { socketId: socket.id, callId });
      });

      socket.on('disconnect', () => {
        logger.info('Client disconnected', { socketId: socket.id, tenantId: socket.tenantId });
        if (socket.tenantId) {
          this.removeFromTenantRoom(socket.tenantId, socket.id);
        }
      });
    });
  }

  private setupEventBusListeners(): void {
    // Listen to internal events and broadcast to WebSocket clients
    eventBus.subscribe('*' as any, async (event: any) => {
      if (event.tenantId) {
        this.broadcastToTenant(event.tenantId, event.type, event);
      }
    });
  }

  private addToTenantRoom(tenantId: string, socketId: string): void {
    if (!this.tenantRooms.has(tenantId)) {
      this.tenantRooms.set(tenantId, new Set());
    }
    this.tenantRooms.get(tenantId)!.add(socketId);
  }

  private removeFromTenantRoom(tenantId: string, socketId: string): void {
    const room = this.tenantRooms.get(tenantId);
    if (room) {
      room.delete(socketId);
      if (room.size === 0) {
        this.tenantRooms.delete(tenantId);
      }
    }
  }

  // Broadcast methods
  broadcastToTenant(tenantId: string, event: string, data: any): void {
    this.io.to(`tenant:${tenantId}`).emit(event, data);
  }

  broadcastToCampaign(campaignId: string, event: string, data: any): void {
    this.io.to(`campaign:${campaignId}`).emit(event, data);
  }

  broadcastToCall(callId: string, event: string, data: any): void {
    this.io.to(`call:${callId}`).emit(event, data);
  }

  broadcastToAll(event: string, data: any): void {
    this.io.emit(event, data);
  }

  // Specific event broadcasts
  broadcastCallStarted(callId: string, data: any): void {
    this.broadcastToCall(callId, 'call:started', data);
  }

  broadcastCallAnswered(callId: string, data: any): void {
    this.broadcastToCall(callId, 'call:answered', data);
  }

  broadcastCallEnded(callId: string, data: any): void {
    this.broadcastToCall(callId, 'call:ended', data);
  }

  broadcastLiveTranscript(callId: string, transcript: string, metadata?: any): void {
    this.broadcastToCall(callId, 'transcript:live', { transcript, metadata });
  }

  broadcastCampaignProgress(campaignId: string, data: any): void {
    this.broadcastToCampaign(campaignId, 'campaign:progress', data);
  }

  broadcastLeadUpdated(tenantId: string, leadId: string, data: any): void {
    this.broadcastToTenant(tenantId, 'lead:updated', { leadId, ...data });
  }

  broadcastAIResponse(callId: string, response: string): void {
    this.broadcastToCall(callId, 'ai:response', { response });
  }

  broadcastNotification(tenantId: string, notification: any): void {
    this.broadcastToTenant(tenantId, 'notification', notification);
  }

  broadcastQueueStats(tenantId: string, stats: any): void {
    this.broadcastToTenant(tenantId, 'queue:stats', stats);
  }

  // Get connection info
  getTenantConnections(tenantId: string): number {
    return this.tenantRooms.get(tenantId)?.size || 0;
  }

  getTotalConnections(): number {
    return this.io.sockets.sockets.size;
  }

  // Close server
  close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        logger.info('WebSocket server closed');
        resolve();
      });
    });
  }
}

export default WebSocketServer;
