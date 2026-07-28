import { TelnyxProvider } from '../../providers/telephony/telnyx.provider';
import { DeepgramProvider } from '../../providers/stt/deepgram.provider';
import { ElevenLabsProvider } from '../../providers/tts/elevenlabs.provider';
import { ConversationEngine } from '../conversation-engine/conversation-engine.service';
import { MemoryService } from '../memory/memory.service';
import { VoiceAgentConfig, VoiceAgentState } from './types';
import googleSheetsService from '../google-sheets/google-sheets.service';
import logger from '../../config/logger';
import config from '../../config';

export class VoiceAgentService {
  private telnyxProvider: TelnyxProvider;
  private sttProvider: DeepgramProvider;
  private ttsProvider: ElevenLabsProvider;
  private conversationEngine: ConversationEngine;
  private memoryService: MemoryService;
  private agents: Map<string, VoiceAgentState>;

  constructor() {
    this.telnyxProvider = new TelnyxProvider();
    this.sttProvider = new DeepgramProvider();
    this.ttsProvider = new ElevenLabsProvider();
    this.conversationEngine = new ConversationEngine();
    this.memoryService = new MemoryService();
    this.agents = new Map();
  }

  async initializeAgent(config: VoiceAgentConfig, customerContext?: { name?: string; email?: string; phone?: string; leadId?: string }): Promise<VoiceAgentState> {
    // Create conversation context with customer data
    await this.conversationEngine.createContext(config.sessionId, {
      leadId: config.leadId,
      phoneNumber: config.phoneNumber,
      customerName: customerContext?.name,
      customerEmail: customerContext?.email,
      customerPhone: customerContext?.phone,
    });

    // Create memory with customer data
    await this.memoryService.createConversationMemory(config.sessionId, {
      leadId: config.leadId,
      phoneNumber: config.phoneNumber,
      customerName: customerContext?.name,
      customerEmail: customerContext?.email,
    });

    // Initialize agent state
    const agentState: VoiceAgentState = {
      sessionId: config.sessionId,
      isActive: true,
      currentStage: 'greeting',
      lastActivity: new Date(),
      customerContext: customerContext,
    };

    this.agents.set(config.sessionId, agentState);

    logger.info('=== VOICE AGENT INITIALIZED ===', { 
      sessionId: config.sessionId,
      customerName: customerContext?.name,
      customerEmail: customerContext?.email,
      customerPhone: customerContext?.phone,
      leadId: customerContext?.leadId
    });

    return agentState;
  }

  async processAudio(sessionId: string, audioBuffer: Buffer): Promise<Buffer> {
    const agentState = this.agents.get(sessionId);

    if (!agentState || !agentState.isActive) {
      throw new Error(`Agent not active for session: ${sessionId}`);
    }

    try {
      // Step 1: Transcribe audio using Deepgram
      const sttResult = await this.sttProvider.transcribe(audioBuffer);
      const transcript = sttResult.transcript;

      logger.info('Audio transcribed', { sessionId, transcript });

      if (!transcript || transcript.trim().length === 0) {
        // Return empty audio if no speech detected
        return Buffer.alloc(0);
      }

      // Step 2: Process transcript through conversation engine
      const aiResponse = await this.conversationEngine.processMessage(
        sessionId,
        transcript
      );

      // Add to memory
      await this.memoryService.addMessage(sessionId, 'user', transcript);
      await this.memoryService.addMessage(sessionId, 'assistant', aiResponse.content);

      // Step 3: Convert AI response to audio using ElevenLabs
      const ttsResult = await this.ttsProvider.synthesize(aiResponse.content);

      // Update agent state
      agentState.lastActivity = new Date();
      this.agents.set(sessionId, agentState);

      logger.info('Voice agent response generated', {
        sessionId,
        transcriptLength: transcript.length,
        responseLength: aiResponse.content.length,
        audioSize: ttsResult.audioBuffer.length,
      });

      return ttsResult.audioBuffer;
    } catch (error) {
      logger.error('Voice agent audio processing failed', { sessionId, error });
      throw error;
    }
  }

  async makeCall(phoneNumber: string, sessionId: string): Promise<string> {
    try {
      // Use NGROK_URL as webhook URL for outbound calls
      const webhookUrl = config.ngrokUrl || config.webhookUrl;
      
      const callResult = await this.telnyxProvider.createCall({
        to: phoneNumber,
        webhookUrl: `${webhookUrl}/telnyx/webhook`,
        metadata: { sessionId },
      });

      // Update agent state with call ID
      const agentState = this.agents.get(sessionId);
      if (agentState) {
        agentState.callId = callResult.callId;
        this.agents.set(sessionId, agentState);
      }

      logger.info('Outbound call initiated', { sessionId, callId: callResult.callId, phoneNumber, webhookUrl });

      // Register audio callback immediately for outbound calls
      // (don't wait for call.answered event which may not arrive)
      const telnyxMediaProvider = require('../../providers/telephony/telnyx-media.provider').default;
      telnyxMediaProvider.onAudio(async (callId: string, audio: Buffer) => {
        logger.info('=== MEDIA PACKET RECEIVED (from makeCall) ===', { 
          callId, sessionId,
          packetSize: audio.length 
        });
        
        try {
          const transcript = await this.sttProvider.transcribe(audio);
          logger.info('=== TRANSCRIPT ===', { callId, transcript: transcript.transcript });
          
          if (transcript.transcript && transcript.transcript.trim().length > 0) {
            const response = await this.conversationEngine.processMessage(sessionId, transcript.transcript);
            logger.info('=== AI RESPONSE ===', { callId, response: response.content });
            
            const ttsAudio = await this.ttsProvider.synthesize(response.content);
            logger.info('=== TTS AUDIO ===', { callId, audioSize: ttsAudio.audioBuffer.length });
            
            await telnyxMediaProvider.sendAudio(callId, ttsAudio.audioBuffer);
            logger.info('=== AUDIO SENT TO CALLER ===', { callId });
          }
        } catch (error) {
          logger.error('=== AUDIO PROCESSING FAILED ===', { callId, error });
        }
      });

      return callResult.callId;
    } catch (error) {
      logger.error('Failed to make call', { sessionId, phoneNumber, error });
      throw error;
    }
  }

  async endCall(sessionId: string): Promise<void> {
    const agentState = this.agents.get(sessionId);

    if (!agentState) {
      throw new Error(`Agent not found for session: ${sessionId}`);
    }

    if (agentState.callId) {
      await this.telnyxProvider.endCall(agentState.callId);
    }

    agentState.isActive = false;
    this.agents.set(sessionId, agentState);

    // Cleanup
    await this.memoryService.clearConversationMemory(sessionId);
    this.conversationEngine.clearContext(sessionId);

    logger.info('Call ended and agent cleaned up', { sessionId });
  }

  getAgentState(sessionId: string): VoiceAgentState | undefined {
    return this.agents.get(sessionId);
  }

  async handleWebhook(webhookData: any): Promise<void> {
    // Parse Telnyx webhook structure
    // Telnyx sends: { data: { event_type: "...", payload: { call_control_id: "...", state: "..." } } }
    const eventType = webhookData.data?.event_type || webhookData.event_type || webhookData.event;
    const payload = webhookData.data?.payload || webhookData.data;
    const callId = payload?.call_control_id || payload?.call_id || webhookData.call_id;
    const callState = payload?.state;
    
    logger.info('=== WEBHOOK EVENT PROCESSING ===', { 
      eventType, 
      callId, 
      callState,
      allEventTypes: [
        webhookData.data?.event_type,
        webhookData.event_type,
        webhookData.event
      ]
    });
    
    // Find session by call ID since client_state is not available
    let sessionId = null;
    for (const [id, state] of this.agents.entries()) {
      logger.info('Checking existing session', { 
        checkingSessionId: id, 
        sessionCallId: state.callId, 
        targetCallId: callId,
        match: state.callId === callId 
      });
      if (state.callId === callId) {
        sessionId = id;
        logger.info('=== FOUND MATCHING SESSION ===', { sessionId, callId });
        break;
      }
    }

    if (!sessionId && callId) {
      // If no session found, create one using call ID as session ID
      sessionId = callId;
      logger.info('=== CREATING NEW SESSION ===', { sessionId, callId, phoneNumber: payload?.to });
      await this.initializeAgent({ sessionId, phoneNumber: payload?.to });
    }

    if (!sessionId) {
      logger.error('=== NO SESSION ID OR CALL ID ===', { webhookData });
      return;
    }

    const agentState = this.agents.get(sessionId);

    if (!agentState) {
      logger.error('=== WEBHOOK FOR UNKNOWN SESSION ===', { sessionId, callId });
      return;
    }

    logger.info('=== SESSION STATE ===', { 
      sessionId, 
      callId, 
      currentStage: agentState.currentStage,
      isActive: agentState.isActive,
      storedCallId: agentState.callId 
    });

    // Update call ID if provided
    if (callId && !agentState.callId) {
      agentState.callId = callId;
      this.agents.set(sessionId, agentState);
      logger.info('=== UPDATED CALL ID IN SESSION ===', { sessionId, callId });
    }

    // Handle different webhook events
    logger.info('=== SWITCHING ON EVENT TYPE ===', { eventType });
    switch (eventType) {
      case 'call.initiated':
      case 'call_initiated':
        logger.info('=== CALL INITIATED EVENT ===', { sessionId, callId, callState });
        break;

      case 'call.answered':
      case 'call_answered':
        logger.info('=== CALL ANSWERED EVENT - CALL CONTROL ID ===', { sessionId, callId, callState, callControlId: payload?.call_control_id });
        agentState.currentStage = 'conversation';
        this.agents.set(sessionId, agentState);
        
        // Set up audio callback for STT processing
        try {
          const telnyxMediaProvider = require('../../providers/telephony/telnyx-media.provider').default;
          
          telnyxMediaProvider.onAudio(async (callId: string, audio: Buffer) => {
            logger.info('=== MEDIA PACKET RECEIVED ===', { 
              callId, 
              timestamp: new Date().toISOString(),
              packetSize: audio.length,
              codec: 'PCMU/PCMA'
            });
            
            try {
              // Transcribe audio using Deepgram
              logger.info('=== TRANSCRIBING AUDIO ===', { callId });
              const transcript = await this.sttProvider.transcribe(audio);
              logger.info('=== TRANSCRIPT GENERATED ===', { callId, transcript: transcript.transcript });
              
              if (transcript.transcript && transcript.transcript.trim().length > 0) {
                // Generate AI response
                logger.info('=== GENERATING AI RESPONSE ===', { callId, transcript: transcript.transcript });
                const response = await this.conversationEngine.processMessage(sessionId, transcript.transcript);
                logger.info('=== AI RESPONSE GENERATED ===', { callId, response: response.content });
                
                // Generate TTS audio
                logger.info('=== TTS REQUEST SENT ===', { callId, text: response.content });
                const ttsAudio = await this.ttsProvider.synthesize(response.content);
                logger.info('=== TTS AUDIO RECEIVED ===', { 
                  callId, 
                  audioSize: ttsAudio.audioBuffer.length,
                  sampleRate: '24000Hz',
                  encoding: 'PCM16'
                });
                
                // Send audio back via media stream
                logger.info('=== AUDIO SENT TO TELNYX ===', { callId, packetCount: 1 });
                await telnyxMediaProvider.sendAudio(callId, ttsAudio.audioBuffer);
                logger.info('=== AUDIO SENT SUCCESSFULLY ===', { callId });
              }
            } catch (error) {
              logger.error('=== FAILED TO PROCESS AUDIO ===', { callId, error });
            }
          });
          
          logger.info('=== AUDIO CALLBACK SETUP COMPLETE ===', { sessionId, callId });
          
          // For outbound calls, we must send streaming_start via API (not Call Control JSON)
          const streamUrl = telnyxMediaProvider.getServerUrl();
          logger.info('=== STARTING MEDIA STREAMING VIA API ===', { sessionId, callId, streamUrl });
          
          await this.telnyxProvider.startMediaStreaming(callId, streamUrl);
          logger.info('=== MEDIA STREAMING STARTED SUCCESSFULLY ===', { sessionId, callId });
          
        } catch (error) {
          logger.error('=== FAILED TO START MEDIA STREAMING ===', { sessionId, callId, error });
        }
        break;

      case 'call.media_start':
      case 'call_media_start':
        logger.info('=== MEDIA START EVENT - WEBSOCKET CONNECTION ===', { sessionId, callId });
        
        // Connect to Telnyx media stream
        try {
          const streamUrl = payload?.media_stream?.url;
          const streamToken = payload?.media_stream?.token;
          
          if (!streamUrl) {
            logger.error('=== NO MEDIA STREAM URL IN PAYLOAD ===', { sessionId, callId, payload });
            return;
          }
          
          logger.info('=== CONNECTING TO TELNYX MEDIA STREAM ===', { sessionId, callId, streamUrl });
          
          // Import and use media provider
          const telnyxMediaProvider = require('../../providers/telephony/telnyx-media.provider').default;
          
          // Set up audio callback for STT processing
          telnyxMediaProvider.onAudio(async (callId: string, audio: Buffer) => {
            logger.info('=== MEDIA PACKET RECEIVED ===', { 
              callId, 
              timestamp: new Date().toISOString(),
              packetSize: audio.length,
              codec: 'PCMU/PCMA'
            });
            
            try {
              // Transcribe audio using Deepgram
              logger.info('=== TRANSCRIBING AUDIO ===', { callId });
              const transcript = await this.sttProvider.transcribe(audio);
              logger.info('=== TRANSCRIPT GENERATED ===', { callId, transcript: transcript.transcript });
              
              if (transcript.transcript && transcript.transcript.trim().length > 0) {
                // Generate AI response
                logger.info('=== GENERATING AI RESPONSE ===', { callId, transcript: transcript.transcript });
                const response = await this.conversationEngine.processMessage(sessionId, transcript.transcript);
                logger.info('=== AI RESPONSE GENERATED ===', { callId, response: response.content });
                
                // Generate TTS audio
                logger.info('=== TTS REQUEST SENT ===', { callId, text: response.content });
                const ttsAudio = await this.ttsProvider.synthesize(response.content);
                logger.info('=== TTS AUDIO RECEIVED ===', { 
                  callId, 
                  audioSize: ttsAudio.audioBuffer.length,
                  sampleRate: '24000Hz',
                  encoding: 'PCM16'
                });
                
                // Send audio back via media stream
                logger.info('=== AUDIO SENT TO TELNYX ===', { callId, packetCount: 1 });
                await telnyxMediaProvider.sendAudio(callId, ttsAudio.audioBuffer);
                logger.info('=== AUDIO SENT SUCCESSFULLY ===', { callId });
              }
            } catch (error) {
              logger.error('=== FAILED TO PROCESS AUDIO ===', { callId, error });
            }
          });
          
          await telnyxMediaProvider.connectMediaStream({
            callId,
            streamUrl,
            streamToken
          });
          
          logger.info('=== WEBSOCKET CONNECTION ESTABLISHED ===', { sessionId, callId });
          
          // Send greeting audio now that stream is connected
          logger.info('=== AI GREETING TEXT GENERATION ===', { sessionId, callId });
          const greeting = await this.conversationEngine.processMessage(sessionId, '');
          logger.info('=== AI GREETING TEXT ===', { sessionId, callId, greetingText: greeting.content });
          
          logger.info('=== TTS REQUEST SENT ===', { sessionId, callId, text: greeting.content });
          const audioBuffer = await this.ttsProvider.synthesize(greeting.content);
          logger.info('=== TTS AUDIO RECEIVED ===', { 
            sessionId, 
            callId, 
            audioSize: audioBuffer.audioBuffer.length,
            sampleRate: '24000Hz',
            encoding: 'PCM16'
          });
          
          logger.info('=== AUDIO SENT TO TELNYX ===', { sessionId, callId, packetCount: 1 });
          await telnyxMediaProvider.sendAudio(callId, audioBuffer.audioBuffer);
          logger.info('=== GREETING SENT SUCCESSFULLY ===', { sessionId, callId });
          
        } catch (error) {
          logger.error('=== FAILED TO CONNECT MEDIA STREAM ===', { sessionId, callId, error });
        }
        break;

      case 'call.ended':
      case 'call.hangup':
      case 'call_ended':
      case 'call_hangup':
        logger.info('=== CALL ENDED EVENT ===', { sessionId, callId });
        await this.endCall(sessionId);
        break;

      case 'call.recording':
      case 'call_recording':
        logger.info('=== CALL RECORDING EVENT ===', { sessionId, callId });
        break;

      default:
        logger.warn('=== UNHANDLED WEBHOOK EVENT ===', { sessionId, eventType, callId });
    }
    
    logger.info('=== WEBHOOK PROCESSING COMPLETE ===', { eventType, sessionId, callId });
  }

  async cleanupInactiveAgents(maxAgeMinutes: number = 30): Promise<void> {
    const now = new Date();
    const maxAge = maxAgeMinutes * 60 * 1000;

    for (const [sessionId, agentState] of this.agents.entries()) {
      const age = now.getTime() - agentState.lastActivity.getTime();
      if (age > maxAge && !agentState.isActive) {
        this.agents.delete(sessionId);
        logger.info('Inactive agent cleaned up', { sessionId, age });
      }
    }

    // Cleanup conversation engine and memory
    this.conversationEngine.cleanupInactiveSessions(maxAgeMinutes);
    await this.memoryService.cleanupExpiredMemories();
  }

  getActiveAgentCount(): number {
    return Array.from(this.agents.values()).filter((a) => a.isActive).length;
  }

  getAllAgents(): VoiceAgentState[] {
    return Array.from(this.agents.values());
  }

  async makeCallFromGoogleSheets(): Promise<any> {
    try {
      logger.info('=== FETCHING NEXT UNPROCESSED LEAD FROM GOOGLE SHEETS ===');
      
      const lead = await googleSheetsService.getNextUnprocessedLead();
      
      if (!lead) {
        logger.info('=== NO UNPROCESSED LEADS FOUND ===');
        return null;
      }
      
      logger.info('=== LEAD FETCHED FROM GOOGLE SHEETS ===', { 
        leadId: lead.lead_id, 
        name: lead.name, 
        phone: lead.phone, 
        email: lead.email 
      });
      
      // Use original phone for ID generation to avoid special characters in sessionId
      const originalPhone = (lead as any).originalPhone || lead.phone;
      const leadIdStr = String(lead.lead_id || originalPhone);
      const sessionId = `lead_${leadIdStr}_${Date.now()}`;
      const phoneStr = String(lead.phone); // Use formatted phone for call
      const nameStr = lead.name ? String(lead.name) : undefined;
      const emailStr = lead.email ? String(lead.email) : undefined;
      
      await this.initializeAgent(
        { sessionId, phoneNumber: phoneStr, leadId: leadIdStr }, 
        { name: nameStr, email: emailStr, phone: phoneStr, leadId: leadIdStr }
      );
      
      const callId = await this.makeCall(phoneStr, sessionId);
      
      logger.info('=== PRODUCTION CALL INITIATED ===', { sessionId, callId, lead });
      
      return { sessionId, callId, lead };
    } catch (error) {
      logger.error('=== FAILED TO MAKE CALL FROM GOOGLE SHEETS ===', { error });
      throw error;
    }
  }
}
