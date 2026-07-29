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
  private streamIds: Map<string, string> = new Map();
  private onAudioCallback?: (callId: string, audio: Buffer) => void;
  private onStreamStartCallback?: (callId: string, streamId: string) => void;

  /**
   * Set callback for incoming audio
   */
  onAudio(callback: (callId: string, audio: Buffer) => void): void {
    this.onAudioCallback = callback;
  }

  /**
   * Set callback for media stream start
   */
  onMediaStreamStart(callback: (callId: string, streamId: string) => void): void {
    this.onStreamStartCallback = callback;
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
    } catch (err: unknown) {
      const e = err as Error;
      logger.error('=== WEBSOCKET SERVER ATTACHMENT FAILED ===', { error: e.message, stack: e.stack });
      throw err;
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
      // Check if data is binary (raw audio) or text (JSON control message)
      const dataStr = data.toString();
      
      // If it doesn't start with '{', treat as raw binary audio
      if (!dataStr.startsWith('{')) {
        // Raw binary RTP audio frame from Telnyx
        this.handleRawAudioFrame(ws, data);
        return;
      }

      const message = JSON.parse(dataStr);
      
      logger.info('=== TELNYX MESSAGE RECEIVED ===', { eventType: message.event });

      switch (message.event) {
        case 'connected':
          logger.info('=== TELNYX CONNECTED ===', { version: message.version });
          break;

        case 'start':
          const streamId = message.start?.stream_id || message.stream_id;
          const startCallId = message.start?.call_control_id || message.call_control_id || message.start?.call_id || message.call_id || streamId;
          logger.info('=== TELNYX MEDIA STREAM STARTED ===', { 
            callId: startCallId,
            streamId,
            mediaFormat: message.start?.media_format 
          });

          this.connections.set(startCallId, ws);
          this.audioBuffers.set(startCallId, []);
          this.streamIds.set(startCallId, streamId);
          // Also map by stream_id for media frame lookup
          if (streamId && streamId !== startCallId) {
            this.connections.set(streamId, ws);
            this.audioBuffers.set(streamId, []);
            this.streamIds.set(streamId, streamId);
          }

          if (this.onStreamStartCallback) {
            this.onStreamStartCallback(startCallId, streamId);
          }
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
   * Handle raw binary audio frames from Telnyx WebSocket
   */
  private handleRawAudioFrame(ws: WebSocket, data: Buffer): void {
    const callId = 'raw-stream'; // Use a default key for raw binary streams
    
    // Buffer audio for processing - create buffer if it doesn't exist
    let buffer = this.audioBuffers.get(callId);
    if (!buffer) {
      logger.info('=== RAW AUDIO STREAM STARTED ===', { dataSize: data.length });
      buffer = [];
      this.audioBuffers.set(callId, buffer);
      // Also store the WebSocket connection
      this.connections.set(callId, ws);
    }

    buffer.push({
      data: data,
      timestamp: Date.now()
    });

    // Process audio when buffer reaches threshold (~2 seconds of audio at 8kHz PCMU = ~16000 bytes)
    const totalSize = buffer.reduce((sum, p) => sum + p.data.length, 0);
    if (totalSize >= 16000) {
      this.processAudioBuffer(callId);
    }
  }

  /**
   * Handle media frame from Telnyx (JSON format)
   */
  private handleMediaFrame(message: any): void {
    const callId = message.stream_id || 'default-stream';
    const base64Payload = message.media?.payload || message.payload || message.media?.chunk;
    
    // Log first few media messages to debug structure
    if (!this.audioBuffers.has(callId)) {
      logger.info('=== FIRST MEDIA FRAME STRUCTURE ===', { 
        callId,
        keys: Object.keys(message),
        mediaKeys: message.media ? Object.keys(message.media) : 'no media field',
        hasPayload: !!base64Payload,
        streamId: message.stream_id,
        sampleMessage: JSON.stringify(message).substring(0, 500)
      });
    }

    if (!base64Payload) {
      return;
    }

    // Decode base64 RTP payload
    const audioBuffer = Buffer.from(base64Payload, 'base64');

    // Buffer audio for processing - create buffer if it doesn't exist
    let buffer = this.audioBuffers.get(callId);
    if (!buffer) {
      logger.info('=== CREATING AUDIO BUFFER FOR STREAM ===', { callId });
      buffer = [];
      this.audioBuffers.set(callId, buffer);
    }

    buffer.push({
      data: audioBuffer,
      timestamp: Date.now()
    });

    // Process audio when buffer reaches threshold (~2 seconds of audio = ~100 packets)
    if (buffer.length >= 100) {
      this.processAudioBuffer(callId);
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

  getStreamId(callId: string): string | undefined {
    return this.streamIds.get(callId) || callId;
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
      // Telnyx media streaming expects 20 ms PCMU/mu-law frames (160 bytes at 8 kHz)
      const chunkSize = 160;
      let chunkCount = 0;
      for (let offset = 0; offset < audioBuffer.length; offset += chunkSize) {
        const chunk = audioBuffer.slice(offset, offset + chunkSize);
        const base64Audio = chunk.toString('base64');
        
        const streamId = this.streamIds.get(callId) || callId;
        const mediaFrame = {
          event: 'media',
          stream_id: streamId,
          media: {
            track: 'outbound',
            payload: base64Audio
          }
        };

        ws.send(JSON.stringify(mediaFrame));
        chunkCount++;
        if (offset + chunkSize < audioBuffer.length) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }

      logger.info('=== SENDING AUDIO TO TELNYX ===', { 
        callId, 
        audioSize: audioBuffer.length,
        chunks: chunkCount
      });
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
