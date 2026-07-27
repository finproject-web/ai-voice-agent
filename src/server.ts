import express, { Application } from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import config from './config';
import logger from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/error';
import { rateLimiter, securityHeaders, corsOptions } from './middleware/security';
import apiRoutes from './routes';
import telnyxRoutes from './routes/telnyx.routes';
import voiceRoutes from './routes/voice.routes';
import telnyxMediaProvider from './providers/telephony/telnyx-media.provider';

class Server {
  private app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Trust proxy (needed for ngrok/reverse proxy X-Forwarded-For headers)
    this.app.set('trust proxy', 1);

    // Security headers
    this.app.use(securityHeaders);

    // CORS
    this.app.use(cors(corsOptions));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression
    this.app.use(compression());

    // Logging
    if (config.nodeEnv === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Rate limiting
    this.app.use(rateLimiter);

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      next();
    });
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use(`/api/${config.apiVersion}`, apiRoutes);

    // Direct Telnyx webhook route (for compatibility with Telnyx webhook URL)
    this.app.use('/telnyx', telnyxRoutes);

    // Telnyx Voice API routes (for Telnyx Voice Application webhooks)
    this.app.use('/voice', voiceRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Enterprise AI Sales Automation Platform API',
        version: config.apiVersion,
        environment: config.nodeEnv,
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public start(): void {
    const port = config.port;

    const httpServer = this.app.listen(port, () => {
      logger.info(`Server running on port ${port} in ${config.nodeEnv} mode`);
      logger.info(`API endpoint: http://localhost:${port}/api/${config.apiVersion}`);
      logger.info(`=== CONFIGURATION VALUES ===`);
      logger.info(`NGROK_URL: ${config.ngrokUrl}`);
      logger.info(`TELNYX_MEDIA_STREAM_URL: ${config.telnyxMediaStreamUrl}`);
      
      // Start Telnyx media WebSocket server attached to HTTP server
      telnyxMediaProvider.startServer(httpServer)
        .then(() => {
          logger.info('Telnyx media WebSocket server started on HTTP server');
        })
        .catch((error) => {
          logger.error('Failed to start Telnyx media WebSocket server', { error: error.message, stack: error.stack });
        });
    });
  }

  public getApp(): Application {
    return this.app;
  }
}

// Start server if not in test mode
if (config.nodeEnv !== 'test') {
  const server = new Server();
  server.start();
}

export default Server;
