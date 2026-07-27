import WebSocket from 'ws';
import logger from '../../config/logger';
import config from '../../config';

interface MediaStreamOptions {
  callId: string;
  streamUrl: string;
  streamToken?: string;
}

interface AudioPacket {
  data: Buffer;
  timestamp: number;
}

class TelnyxMediaProvider {
  private server: WebSocket.Server | null = null;
  private connections: Map<string, WebSocket> = new Map();
  private audioBuffers: Map<string, AudioPacket[]> = new Map();
  private onAudioCallback?: (callId: string, audio: Buffer) => void;

  /**
   * Set callback for incoming audio
   */
  onAudio(callback: (callId: string, audio: Buffer) => void): void {
    this.onAudioCallback = callback;
  }

  /**
   * Start WebSocket server for Telnyx media streaming
   * Attach to existing HTTP server instead of separate port
   */
  async startServer(httpServer: any): Promise<void> {
    if (this.server) {
      logger.warn('WebSocket server already running');
      return;
    }

    try {
      logger.info('=== ATTACHING WEBSOCKET SERVER TO HTTP SERVER ===', { httpServer: !!httpServer });
      this.server = new WebSocket.Server({ server: httpServer });
      logger.info('=== WEBSOCKET SERVER ATTACHED SUCCESSFULLY ===');
    } catch (error) {
      logger.error('=== WEBSOCKET SERVER ATTACHMENT FAILED ===', { error: error.message, stack: error.stack });
      throw error;
    }

    this.server.on('connection', (ws: WebSocket) => {
      logger.info('=== TELNYX WEBSOCKET CONNECTION ESTABLISHED ===');
      console.log("TELNYX WEBSOCKET CONNECTED");

      ws.on('message', (data: Buffer) => {
        console.log("TELNYX MEDIA MESSAGE RECEIVED");
        this.handleTelnyxMessage(ws, data);
      });

      ws.on('error', (error: Error) => {
        logger.error('=== WEBSOCKET ERROR ===', { error: error.message });
      });

      ws.on('close', () => {
        logger.info('=== WEBSOCKET CONNECTION CLOSED ===');
      });
    });

    logger.info('=== TELNYX MEDIA WEBSOCKET SERVER STARTED ON HTTP SERVER ===');
  }

  /**
   * Handle incoming messages from Telnyx
   */
  private handleTelnyxMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      
      logger.info('=== TELNYX MESSAGE RECEIVED ===', { eventType: message.event });

      switch (message.event) {
        case 'connected':
          logger.info('=== TELNYX CONNECTED ===', { version: message.version });
          break;

        case 'start':
          const callId = message.start.call_control_id;
          logger.info('=== TELNYX MEDIA STREAM STARTED ===', { 
            callId,
            mediaFormat: message.start.media_format 
          });

          this.connections.set(callId, ws);
          this.audioBuffers.set(callId, []);
          break;

        case 'media':
          this.handleMediaFrame(message);
          break;

        case 'stop':
          logger.info('=== TELNYX MEDIA STREAM STOPPED ===', { streamId: message.stream_id });
          break;

        case 'error':
          logger.error('=== TELNYX MEDIA STREAM ERROR ===', { 
            code: message.payload.code,
            title: message.payload.title,
            detail: message.payload.detail
          });
          break;

        default:
          logger.info('=== UNHANDLED TELNYX EVENT ===', { event: message.event });
      }
    } catch (error) {
      logger.error('=== FAILED TO PARSE TELNYX MESSAGE ===', { error });
    }
  }

  /**
   * Handle media frame from Telnyx
   */
  private handleMediaFrame(message: any): void {
    const callId = message.stream_id; // Use stream_id to identify call
    const base64Payload = message.media.payload;
    
    if (!base64Payload) {
      return;
    }

    console.log("AUDIO PACKET RECEIVED");
    console.log(base64Payload.length);

    // Decode base64 RTP payload
    const audioBuffer = Buffer.from(base64Payload, 'base64');

    logger.info('=== AUDIO FRAME RECEIVED ===', { 
      callId,
      track: message.media.track,
      chunk: message.media.chunk,
      audioSize: audioBuffer.length
    });

    // Buffer audio for processing
    const buffer = this.audioBuffers.get(callId);
    if (buffer) {
      buffer.push({
        data: audioBuffer,
        timestamp: Date.now()
      });

      // Process audio when buffer reaches threshold
      if (buffer.length >= 10) { // ~80ms of audio at 8kHz
        this.processAudioBuffer(callId);
      }
    }
  }

  /**
   * Process buffered audio through STT pipeline
   */
  private async processAudioBuffer(callId: string): Promise<void> {
    const buffer = this.audioBuffers.get(callId);
    if (!buffer || buffer.length === 0) return;

    logger.info('=== PROCESSING AUDIO BUFFER ===', { callId, packetCount: buffer.length });

    // Combine audio packets
    const combinedAudio = Buffer.concat(buffer.map(p => p.data));
    buffer.length = 0; // Clear buffer

    // Emit event for STT processing
    logger.info('=== AUDIO READY FOR STT ===', { 
      callId, 
      audioSize: combinedAudio.length 
    });

    // Call callback if set
    if (this.onAudioCallback) {
      this.onAudioCallback(callId, combinedAudio);
    }
  }

  /**
   * Send audio back to Telnyx media stream
   */
  async sendAudio(callId: string, audioBuffer: Buffer): Promise<void> {
    const ws = this.connections.get(callId);
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logger.error('=== CANNOT SEND AUDIO - NO CONNECTION ===', { callId });
      return;
    }

    try {
      // Encode audio as base64 and send as media frame
      const base64Audio = audioBuffer.toString('base64');
      
      const mediaFrame = {
        event: 'media',
        media: {
          track: 'outbound',
          payload: base64Audio
        }
      };

      logger.info('=== SENDING AUDIO TO TELNYX ===', { 
        callId, 
        audioSize: audioBuffer.length 
      });

      ws.send(JSON.stringify(mediaFrame));
    } catch (error) {
      logger.error('=== FAILED TO SEND AUDIO TO TELNYX ===', { callId, error });
    }
  }

  /**
   * Disconnect media stream
   */
  async disconnectMediaStream(callId: string): Promise<void> {
    const ws = this.connections.get(callId);
    
    if (ws) {
      logger.info('=== DISCONNECTING TELNYX MEDIA STREAM ===', { callId });
      ws.close();
      this.connections.delete(callId);
      this.audioBuffers.delete(callId);
    }
  }

  /**
   * Check if media stream is connected
   */
  isConnected(callId: string): boolean {
    const ws = this.connections.get(callId);
    return ws ? ws.readyState === WebSocket.OPEN : false;
  }

  /**
   * Get WebSocket server URL for Telnyx
   */
  getServerUrl(): string {
    const ngrokUrl = config.ngrokUrl;
    
    if (ngrokUrl) {
      // Use ngrok URL for WebSocket (Telnyx needs public URL)
      // Convert HTTPS to WSS, remove trailing slash, and add media-stream path
      // WebSocket server is now on same port as HTTP server
      const wsUrl = ngrokUrl.replace(/^https:\/\//, 'wss://').replace(/\/$/, '') + '/media-stream';
      logger.info('=== USING NGROK URL FOR WEBSOCKET ===', { ngrokUrl, wsUrl });
      return wsUrl;
    }
    
    // Fallback to localhost for development
    const address = this.server?.address();
    const port = typeof address === 'string' ? 3000 : (address?.port || 3000);
    logger.warn('=== NO NGROK URL - USING LOCALHOST (TELNYX CANNOT CONNECT) ===', { port });
    return `ws://localhost:${port}`;
  }
}

export default new TelnyxMediaProvider();
