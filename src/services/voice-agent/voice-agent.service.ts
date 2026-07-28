import { TelnyxProvider } from '../../providers/telephony/telnyx.provider';
import { DeepgramProvider } from '../../providers/stt/deepgram.provider';
import { ITTSProvider } from '../../providers/tts/provider.interface';
import { createTTSProvider } from '../../providers/tts/tts.factory';
import { ConversationEngine } from '../conversation-engine/conversation-engine.service';
import { MemoryService } from '../memory/memory.service';
import { VoiceAgentConfig, VoiceAgentState, CustomerContext } from './types';
import { FunctionCall } from '../conversation-engine/types';
import googleSheetsService from '../google-sheets/google-sheets.service';
import emailService from '../email/email.service';
import logger from '../../config/logger';
import config from '../../config';

export class VoiceAgentService {
  private telnyxProvider: TelnyxProvider;
  private sttProvider: DeepgramProvider;
  private ttsProvider: ITTSProvider;
  private conversationEngine: ConversationEngine;
  private memoryService: MemoryService;
  private agents: Map<string, VoiceAgentState>;

  constructor() {
    this.telnyxProvider = new TelnyxProvider();
    this.sttProvider = new DeepgramProvider();
    this.ttsProvider = createTTSProvider();
    this.conversationEngine = new ConversationEngine();
    this.memoryService = new MemoryService();
    this.agents = new Map();
  }

  async initializeAgent(config: VoiceAgentConfig, customerContext?: CustomerContext): Promise<VoiceAgentState> {
    // Create conversation context with customer data
    await this.conversationEngine.createContext(config.sessionId, {
      leadId: config.leadId,
      phoneNumber: config.phoneNumber,
      customerName: customerContext?.name,
      customerEmail: customerContext?.email,
      customerPhone: customerContext?.phone,
      extractedData: customerContext?.leadData || {},
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
      greetingSent: false,
    };

    this.agents.set(config.sessionId, agentState);

    // Pre-generate greeting audio immediately so it is ready before the customer answers
    agentState.greetingAudioPromise = this.generateGreetingAudio(config.sessionId)
      .then((audioBuffer) => {
        agentState.greetingAudioBuffer = audioBuffer;
        this.agents.set(config.sessionId, agentState);
        return audioBuffer;
      })
      .catch((error) => {
        logger.error('=== PRE-GENERATION OF GREETING FAILED ===', { sessionId: config.sessionId, error });
        throw error;
      });
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

      // Step 3: Execute any backend tools requested by the AI
      const toolResult = await this.executeToolCalls(sessionId, aiResponse.functionCalls);

      // Step 4: Convert AI response to audio using TTS provider
      const ttsResult = await this.ttsProvider.synthesize(aiResponse.content);

      // If end call requested, clean up after speaking
      if (toolResult.endCall) {
        setTimeout(() => {
          this.endCall(sessionId).catch((err) => logger.error('Failed to end call after audio', { sessionId, error: err }));
        }, 2000);
      }

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

  private async executeToolCalls(
    sessionId: string,
    functionCalls: FunctionCall[] | undefined
  ): Promise<{ endCall: boolean; transferTo?: string }> {
    const agentState = this.agents.get(sessionId);
    const result: { endCall: boolean; transferTo?: string } = { endCall: false };

    if (!functionCalls || functionCalls.length === 0) {
      return result;
    }

    for (const call of functionCalls) {
      logger.info('=== EXECUTING TOOL ===', { sessionId, tool: call.name, parameters: call.parameters });
      try {
        switch (call.name) {
          case 'readLead':
            logger.info('readLead requested — lead data already loaded from Google Sheets', { sessionId });
            break;

          case 'updateLead':
          case 'updateGoogleSheet': {
            const email = call.parameters?.email || agentState?.customerContext?.email;
            if (!email) {
              logger.warn('updateGoogleSheet missing email', { sessionId });
              break;
            }
            const { email: _email, ...leadData } = call.parameters;
            await googleSheetsService.updateLead(email, leadData);
            logger.info('Google Sheet updated', { sessionId, email, leadData });
            break;
          }

          case 'sendLoanEmail': {
            const email = call.parameters?.email || agentState?.customerContext?.email;
            const customerName = agentState?.customerContext?.name || 'Customer';
            const loanAmount = call.parameters?.loanAmount;
            if (!email) {
              logger.warn('sendLoanEmail missing email', { sessionId });
              break;
            }
            await emailService.sendApplicationEmail(customerName, email, loanAmount);
            logger.info('Loan application email sent', { sessionId, email });
            break;
          }

          case 'transferCall': {
            const to = call.parameters?.to || '4702063218';
            result.transferTo = to;
            break;
          }

          case 'endCall':
            result.endCall = true;
            break;

          default:
            logger.warn('Unknown tool call', { sessionId, name: call.name });
        }
      } catch (error) {
        logger.error('Tool execution failed', { sessionId, tool: call.name, error });
      }
    }

    return result;
  }

  private async generateGreetingAudio(sessionId: string): Promise<Buffer> {
    try {
      logger.info('=== GREETING REQUESTED ===', { sessionId, timestamp: new Date().toISOString() });

      const context = this.conversationEngine.getContext(sessionId);
      if (!context) {
        throw new Error(`No conversation context found for session: ${sessionId}`);
      }

      const name = context.customerName || 'the customer';
      const greetingText = `Hi ${name}, this is Sophia from Up Start Loans. Am I speaking with ${name}? I'm calling because you recently applied for a loan and your application has been pre-qualified. Are you still looking for a loan today?`;

      // Seed the conversation history and advance to identity confirmation without waiting for an LLM
      context.messages.push({ role: 'user', content: '', timestamp: new Date() });
      context.messages.push({ role: 'assistant', content: greetingText, timestamp: new Date() });
      context.state = {
        ...context.state,
        currentStage: 'identity_confirmation',
        last_question: 'Are you still looking for a loan today?',
      };
      context.lastActivity = new Date();
      this.conversationEngine.updateContext(sessionId, { messages: context.messages, state: context.state, lastActivity: new Date() });

      logger.info('=== GREETING TEXT ===', { sessionId, text: greetingText, timestamp: new Date().toISOString() });
      logger.info('=== TTS STARTED ===', { sessionId, timestamp: new Date().toISOString() });
      const ttsAudio = await this.ttsProvider.synthesize(greetingText);
      logger.info('=== TTS FINISHED ===', { sessionId, audioSize: ttsAudio.audioBuffer.length, timestamp: new Date().toISOString() });
      return ttsAudio.audioBuffer;
    } catch (error: any) {
      logger.error('=== GREETING GENERATION FAILED ===', { sessionId, error: error?.message || error });
      throw error;
    }
  }

  private syncAgentState(sessionId: string): void {
    const context = this.conversationEngine.getContext(sessionId);
    const agentState = this.agents.get(sessionId);
    if (context && agentState) {
      const stage = context.state?.currentStage || context.currentStage || 'greeting';
      agentState.currentStage = stage;
      this.agents.set(sessionId, agentState);
      logger.info('=== AGENT STATE SYNCED ===', { sessionId, currentStage: stage });
    }
  }

  async makeCall(phoneNumber: string, sessionId: string): Promise<string> {
    try {
      const webhookUrl = config.ngrokUrl || config.webhookUrl;

      const agentState = this.agents.get(sessionId);
      if (!agentState) {
        throw new Error(`No agent state found for session ${sessionId}`);
      }

      // Ensure greeting audio is fully synthesized before the phone ever rings
      if (!agentState.greetingAudioPromise) {
        agentState.greetingAudioPromise = this.generateGreetingAudio(sessionId)
          .then((audioBuffer) => {
            agentState.greetingAudioBuffer = audioBuffer;
            this.agents.set(sessionId, agentState);
            return audioBuffer;
          })
          .catch((error) => {
            logger.error('Greeting audio pre-generation failed', { sessionId, error });
            throw error;
          });
        this.agents.set(sessionId, agentState);
      }

      logger.info('=== AWAITING PRE-GENERATED GREETING ===', { sessionId });
      const greetingAudioBuffer = await agentState.greetingAudioPromise;
      agentState.greetingAudioBuffer = greetingAudioBuffer;
      this.agents.set(sessionId, agentState);
      logger.info('=== PRE-GENERATED GREETING READY ===', { sessionId, audioSize: greetingAudioBuffer.length });
      this.syncAgentState(sessionId);

      // Place the call only after greeting audio is ready
      const callResult = await this.telnyxProvider.createCall({
        to: phoneNumber,
        webhookUrl: `${webhookUrl}/telnyx/webhook`,
        metadata: { sessionId },
      });

      agentState.callId = callResult.callId;
      this.agents.set(sessionId, agentState);

      logger.info('Outbound call initiated', { sessionId, callId: callResult.callId, phoneNumber, webhookUrl });

      // Register audio callback immediately for outbound calls
      // (don't wait for call.answered event which may not arrive)
      const telnyxMediaProvider = require('../../providers/telephony/telnyx-media.provider').default;
      let isSpeaking = false;
      let lastResponseTime = 0;

      telnyxMediaProvider.onAudio(async (callId: string, audio: Buffer) => {
        // Skip processing while AI is speaking (prevent echo loop)
        if (isSpeaking) {
          return;
        }

        // Debounce: short pause after AI speaks before listening again
        if (Date.now() - lastResponseTime < 800) {
          return;
        }

        logger.info('=== MEDIA PACKET RECEIVED (from makeCall) ===', { 
          callId, sessionId,
          packetSize: audio.length 
        });
        
        try {
          const transcript = await this.sttProvider.transcribe(audio);
          logger.info('=== TRANSCRIPT ===', { callId, transcript: transcript.transcript });
          
          // Only respond if transcript has meaningful content (more than 2 chars)
          if (transcript.transcript && transcript.transcript.trim().length > 2) {
            isSpeaking = true;
            lastResponseTime = Date.now();

            const response = await this.conversationEngine.processMessage(sessionId, transcript.transcript);
            this.syncAgentState(sessionId);
            logger.info('=== AI RESPONSE ===', { callId, response: response.content });

            const toolResult = await this.executeToolCalls(sessionId, response.functionCalls);
            logger.info('=== TOOL RESULTS ===', { callId, ...toolResult });
            
            const ttsAudio = await this.ttsProvider.synthesize(response.content);
            logger.info('=== TTS AUDIO ===', { callId, audioSize: ttsAudio.audioBuffer.length });
            
            await telnyxMediaProvider.sendAudio(callId, ttsAudio.audioBuffer);
            logger.info('=== AUDIO SENT TO CALLER ===', { callId });

            // Handle terminating tools after the AI has spoken
            if (toolResult.endCall) {
              await this.endCall(sessionId);
              return;
            }
            if (toolResult.transferTo && callId) {
              await this.telnyxProvider.transferCall(callId, toolResult.transferTo);
              return;
            }

            // Estimate TTS playback time: ~60ms per character spoken
            const estimatedPlaybackMs = response.content.length * 60;
            setTimeout(() => {
              isSpeaking = false;
              logger.info('=== AI DONE SPEAKING, LISTENING AGAIN ===', { callId });
            }, estimatedPlaybackMs);
          }
        } catch (error) {
          isSpeaking = false;
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
        logger.info('=== CALL ANSWERED ===', { sessionId, callId, callState, callControlId: payload?.call_control_id, timestamp: new Date().toISOString() });
        agentState.callAnsweredAt = Date.now();
        this.agents.set(sessionId, agentState);
        
        // Audio callback is already registered in makeCall. Only start streaming here.
        try {
          const telnyxMediaProvider = require('../../providers/telephony/telnyx-media.provider').default;
          
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
          
          // Audio callback is already registered in makeCall. Do not register again.
          await telnyxMediaProvider.connectMediaStream({
            callId,
            streamUrl,
            streamToken
          });
          
          logger.info('=== WEBSOCKET CONNECTION ESTABLISHED ===', { sessionId, callId });
          
          // Send greeting audio once
          if (!agentState.greetingSent) {
            agentState.greetingSent = true;
            this.agents.set(sessionId, agentState);
            
            let audioBuffer: Buffer;
            if (agentState.greetingAudioBuffer) {
              audioBuffer = agentState.greetingAudioBuffer;
              logger.info('=== USING PRE-GENERATED GREETING AUDIO ===', { sessionId, callId, audioSize: audioBuffer.length });
            } else if (agentState.greetingAudioPromise) {
              logger.info('=== WAITING FOR PRE-GENERATED GREETING AUDIO ===', { sessionId, callId });
              audioBuffer = await agentState.greetingAudioPromise;
            } else {
              logger.warn('=== GREETING NOT PRE-GENERATED, GENERATING NOW ===', { sessionId, callId });
              audioBuffer = await this.generateGreetingAudio(sessionId);
            }
            
            logger.info('=== AUDIO SENT TO TELNYX ===', { sessionId, callId, packetCount: 1, audioSize: audioBuffer.length });
            await telnyxMediaProvider.sendAudio(callId, audioBuffer);
            const latencyMs = agentState.callAnsweredAt ? Date.now() - agentState.callAnsweredAt : -1;
            logger.info('=== FIRST AUDIO SENT ===', { sessionId, callId, latencyMs, audioSize: audioBuffer.length, timestamp: new Date().toISOString() });
          }
          
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
        { name: nameStr, email: emailStr, phone: phoneStr, leadId: leadIdStr, leadData: lead as Record<string, any> }
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
