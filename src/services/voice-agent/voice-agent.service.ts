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
import { convertPcmToMulaw as convertToMulaw } from '../../utils/mulaw';
import telnyxMediaProvider from '../../providers/telephony/telnyx-media.provider';

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
      greetingFinished: false,
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
  ): Promise<{ endCall: boolean; transferTo?: string; emailInitiated?: { email: string; status: string } }> {
    const agentState = this.agents.get(sessionId);
    const result: { endCall: boolean; transferTo?: string; emailInitiated?: { email: string; status: string } } = { endCall: false };

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
            const loanAmount = call.parameters?.loanAmount || agentState?.loanAmount;
            if (!email) {
              logger.warn('sendLoanEmail missing email', { sessionId });
              break;
            }
            // Send in the background so TTS/playback is not delayed by SMTP.
            logger.info('Initiating loan application email', { sessionId, email, customerName, loanAmount });
            result.emailInitiated = { email, status: 'sending' };
            emailService.sendApplicationEmail(customerName, email, loanAmount)
              .then((emailResult) => {
                if (emailResult.success) {
                  logger.info('Loan application email sent', { sessionId, email, messageId: emailResult.messageId });
                } else {
                  logger.warn('Loan application email failed', { sessionId, email, error: emailResult.error });
                }
              })
              .catch((error) => logger.error('Loan application email send failed', { sessionId, email, error: error?.message || error }));
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
      const greetingText = `Hello, this is Sofia from Upstart Loans. Can I talk to ${name}?`;

      // Seed the conversation history and advance to identity confirmation without waiting for an LLM
      context.messages.push({ role: 'user', content: '', timestamp: new Date() });
      context.messages.push({ role: 'assistant', content: greetingText, timestamp: new Date() });
      context.state = {
        ...context.state,
        currentStage: 'identity_confirmation',
        last_question: 'Can I talk to you?',
        greeted: true,
      };
      context.lastActivity = new Date();
      this.conversationEngine.updateContext(sessionId, { messages: context.messages, state: context.state, lastActivity: new Date() });

      logger.info('=== GREETING TEXT ===', { sessionId, text: greetingText, timestamp: new Date().toISOString() });
      logger.info('=== TTS STARTED ===', { sessionId, timestamp: new Date().toISOString() });
      const ttsAudio = await this.ttsProvider.synthesize(greetingText);
      logger.info('=== TTS FINISHED ===', { sessionId, audioSize: ttsAudio.audioBuffer.length, timestamp: new Date().toISOString() });
      // OpenAI TTS `response_format: 'pcm'` returns raw 16-bit signed
      // little-endian, mono, 24kHz PCM (no header). Logged explicitly here
      // for audio-quality audit purposes.
      logger.info('=== GREETING PCM AUDIT ===', {
        sessionId,
        pcmSampleRateHz: 24000,
        pcmChannels: 1,
        pcmBitDepth: 16,
        pcmByteLength: ttsAudio.audioBuffer.length,
        pcmSampleCount: ttsAudio.audioBuffer.length / 2,
        resampledSampleRateHz: 8000,
      });
      // Normalize the greeting so the opening words are as loud as the later responses
      const sampleCount = ttsAudio.audioBuffer.length / 2;
      let maxAbs = 0;
      let sumAbs = 0;
      for (let i = 0; i < sampleCount; i++) {
        const s = ttsAudio.audioBuffer.readInt16LE(i * 2);
        const a = Math.abs(s);
        if (a > maxAbs) maxAbs = a;
        sumAbs += a;
      }
      const avgAbs = Math.round(sumAbs / sampleCount);
      const targetPeak = 32767; // full scale so the greeting matches the loud later responses
      const gain = maxAbs > 128 ? targetPeak / maxAbs : 1;
      const scaledBuffer = Buffer.alloc(ttsAudio.audioBuffer.length);
      for (let i = 0; i < sampleCount; i++) {
        const s = ttsAudio.audioBuffer.readInt16LE(i * 2);
        const scaled = Math.max(-32768, Math.min(32767, Math.round(s * gain)));
        scaledBuffer.writeInt16LE(scaled, i * 2);
      }
      logger.info('=== GREETING PCM NORMALIZED ===', { sessionId, maxAbs, avgAbs, gain: Math.round(gain * 1000) / 1000, targetPeak });

      const telnyxAudio = this.convertPcmToMulaw(scaledBuffer);
      const preRoll = Buffer.alloc(160, 0xff); // 20 ms of μ-law silence so the Telnyx stream settles before the voice
      const telnyxAudioWithPreRoll = Buffer.concat([preRoll, telnyxAudio]);
      logger.info('=== GREETING PCMU AFTER CONVERSION ===', { sessionId, pcmuLength: telnyxAudioWithPreRoll.length, first10Bytes: telnyxAudioWithPreRoll.slice(0, 10).toString('hex'), timestamp: new Date().toISOString() });
      logger.info('=== TTS CONVERTED TO TELNYX FORMAT ===', { sessionId, originalSize: ttsAudio.audioBuffer.length, convertedSize: telnyxAudioWithPreRoll.length, timestamp: new Date().toISOString() });
      return telnyxAudioWithPreRoll;
    } catch (error: any) {
      logger.error('=== GREETING GENERATION FAILED ===', { sessionId, error: error?.message || error });
      throw error;
    }
  }

  private convertPcmToMulaw(pcmBuffer: Buffer, inputSampleRate = 24000, outputSampleRate = 8000): Buffer {
    return convertToMulaw(pcmBuffer, inputSampleRate, outputSampleRate);
  }

  private syncAgentState(sessionId: string): void {
    const context = this.conversationEngine.getContext(sessionId);
    const agentState = this.agents.get(sessionId);
    if (context && agentState) {
      const stage = context.state?.currentStage || context.currentStage || 'greeting';
      const loanAmount = context.state?.loanAmount ?? context.state?.loan_amount;
      agentState.currentStage = stage;
      if (loanAmount !== undefined) {
        agentState.loanAmount = loanAmount;
      }
      this.agents.set(sessionId, agentState);
      logger.info('=== AGENT STATE SYNCED ===', { sessionId, currentStage: stage, loanAmount });
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
            logger.error('Greeting audio pre-generation failed, will retry on stream start', { sessionId, error });
            return undefined;
          });
        this.agents.set(sessionId, agentState);
      }

      logger.info('=== AWAITING PRE-GENERATED GREETING ===', { sessionId });
      const greetingAudioBuffer = await agentState.greetingAudioPromise;
      if (greetingAudioBuffer) {
        agentState.greetingAudioBuffer = greetingAudioBuffer;
        this.agents.set(sessionId, agentState);
        logger.info('=== PRE-GENERATED GREETING READY ===', { sessionId, audioSize: greetingAudioBuffer.length });
      }
      this.syncAgentState(sessionId);

      // Register audio and stream-start callbacks before placing the call
      // so we don't miss any WebSocket events if the call answers instantly
      logger.info('=== REGISTERING TELNYX MEDIA CALLBACKS ===', { sessionId });
      let isSpeaking = false;
      let lastResponseTime = 0;

      telnyxMediaProvider.onAudio(async (callId: string, audio: Buffer) => {
        // Skip until the greeting has been played on the line
        if (!this.agents.get(sessionId)?.greetingFinished) {
          return;
        }

        // Skip processing while AI is speaking (prevent echo loop)
        if (isSpeaking) {
          return;
        }

        // Debounce: short pause after AI speaks before listening again
        if (Date.now() - lastResponseTime < 300) {
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

            const response = await this.conversationEngine.processMessage(sessionId, transcript.transcript);
            this.syncAgentState(sessionId);
            logger.info('=== AI RESPONSE ===', { callId, response: response.content });

            const toolResult = await this.executeToolCalls(sessionId, response.functionCalls);
            logger.info('=== TOOL RESULTS ===', { callId, ...toolResult });
            
            const ttsAudio = await this.ttsProvider.synthesize(response.content);
            logger.info('=== TTS AUDIO ===', { callId, audioSize: ttsAudio.audioBuffer.length });
            // OpenAI TTS `response_format: 'pcm'` returns raw 16-bit signed
            // little-endian, mono, 24kHz PCM (no header). Logged explicitly
            // here for audio-quality audit purposes.
            logger.info('=== RESPONSE PCM AUDIT ===', {
              callId,
              pcmSampleRateHz: 24000,
              pcmChannels: 1,
              pcmBitDepth: 16,
              pcmByteLength: ttsAudio.audioBuffer.length,
              pcmSampleCount: ttsAudio.audioBuffer.length / 2,
              resampledSampleRateHz: 8000,
            });

            const telnyxAudio = this.convertPcmToMulaw(ttsAudio.audioBuffer);
            logger.info('=== RESPONSE PCMU AFTER CONVERSION ===', { callId, pcmuLength: telnyxAudio.length, first10Bytes: telnyxAudio.slice(0, 10).toString('hex') });
            logger.info('=== TTS CONVERTED ===', { callId, originalSize: ttsAudio.audioBuffer.length, convertedSize: telnyxAudio.length });

            const responseStreamId = telnyxMediaProvider.getStreamId(callId);
            logger.info('=== SENDING AUDIO TO TELNYX ===', { callId, streamId: responseStreamId, payloadLength: telnyxAudio.length });
            await telnyxMediaProvider.sendAudio(callId, telnyxAudio);
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

            // Let the last chunk finish playing before listening again
            await new Promise((resolve) => setTimeout(resolve, 80));
            isSpeaking = false;
            lastResponseTime = Date.now();
            logger.info('=== AI DONE SPEAKING, LISTENING AGAIN ===', { callId });
          }
        } catch (error) {
          isSpeaking = false;
          logger.error('=== AUDIO PROCESSING FAILED ===', { callId, error });
        }
      });

      // Send the greeting as soon as the Telnyx media stream starts
      telnyxMediaProvider.onMediaStreamStart(async (mediaCallId: string) => {
        logger.info('=== ON MEDIA STREAM START CALLBACK FIRED ===', { sessionId, callId: mediaCallId });
        try {
          const agentState = this.agents.get(sessionId);
          if (!agentState || agentState.greetingSent) {
            return;
          }

          let audioBuffer = agentState.greetingAudioBuffer;
          if (!audioBuffer && agentState.greetingAudioPromise) {
            audioBuffer = await agentState.greetingAudioPromise;
          }
          if (!audioBuffer) {
            audioBuffer = await this.generateGreetingAudio(sessionId);
          }

          const greetingDurationMs = audioBuffer.length / 8;
          const greetingStreamId = telnyxMediaProvider.getStreamId(mediaCallId);
          logger.info('=== SENDING GREETING ON MEDIA STREAM START ===', { sessionId, callId: mediaCallId, audioSize: audioBuffer.length });
          logger.info('=== SENDING AUDIO TO TELNYX ===', { callId: mediaCallId, streamId: greetingStreamId, payloadLength: audioBuffer.length });
          await telnyxMediaProvider.sendAudio(mediaCallId, audioBuffer);
          agentState.greetingSent = true;
          this.agents.set(sessionId, agentState);

          const latencyMs = agentState.callAnsweredAt ? Date.now() - agentState.callAnsweredAt : -1;
          logger.info('=== FIRST AUDIO SENT ===', { sessionId, callId: mediaCallId, latencyMs, audioSize: audioBuffer.length, timestamp: new Date().toISOString() });

          setTimeout(() => {
            agentState.greetingFinished = true;
            this.agents.set(sessionId, agentState);
            logger.info('=== GREETING FINISHED, LISTENING ENABLED ===', { sessionId, callId: mediaCallId, greetingDurationMs });
          }, greetingDurationMs + 80);
        } catch (error: any) {
          logger.error('=== FAILED TO SEND GREETING ON STREAM START ===', { sessionId, callId: mediaCallId, error: error?.message || error, stack: error?.stack });
        }
      });

      // Place the call after callbacks are ready
      const callResult = await this.telnyxProvider.createCall({
        to: phoneNumber,
        webhookUrl: `${webhookUrl}/telnyx/webhook`,
        metadata: { sessionId },
      });

      agentState.callId = callResult.callId;
      this.agents.set(sessionId, agentState);

      logger.info('Outbound call initiated', { sessionId, callId: callResult.callId, phoneNumber, webhookUrl });

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

    if (agentState.callId && agentState.isActive) {
      try {
        await this.telnyxProvider.endCall(agentState.callId);
      } catch (error) {
        // Call may have already ended on Telnyx's side (e.g. the callee
        // hung up before we processed the webhook). This is not fatal.
        logger.warn('Telnyx endCall failed (call likely already ended)', { sessionId, error });
      }
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
      // Try to match an outbound session that hasn't received its call_control_id yet
      const targetPhone = payload?.to;
      for (const [id, state] of this.agents.entries()) {
        const customerPhone = state.customerContext?.phone;
        if (customerPhone && targetPhone && (customerPhone === targetPhone || customerPhone.replace(/\D/g, '') === targetPhone.replace(/\D/g, ''))) {
          sessionId = id;
          state.callId = callId;
          this.agents.set(id, state);
          logger.info('=== MATCHED SESSION BY PHONE NUMBER ===', { sessionId, callId, phoneNumber: targetPhone });
          break;
        }
      }

      // Fallback: create a new session
      if (!sessionId) {
        sessionId = callId;
        logger.info('=== CREATING NEW SESSION ===', { sessionId, callId, phoneNumber: targetPhone });
        await this.initializeAgent({ sessionId, phoneNumber: targetPhone });
      }
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
          // For outbound calls, we must send streaming_start via API (not Call Control JSON)
          const streamUrl = telnyxMediaProvider.getServerUrl();
          logger.info('=== STARTING MEDIA STREAMING VIA API ===', { sessionId, callId, streamUrl });
          
          await this.telnyxProvider.startMediaStreaming(callId, streamUrl);
          logger.info('=== MEDIA STREAMING STARTED SUCCESSFULLY ===', { sessionId, callId });

          // Fallback: if the WebSocket start event never fires, push the greeting
          // once the connection is established and we see a media frame.
          setTimeout(async () => {
            const currentState = this.agents.get(sessionId);
            if (!currentState || currentState.greetingSent || currentState.greetingFinished) {
              return;
            }
            if (!telnyxMediaProvider.isConnected(callId)) {
              logger.warn('=== DIRECT GREETING FALLBACK: NO CONNECTION YET ===', { sessionId, callId });
              return;
            }
            let audioBuffer = currentState.greetingAudioBuffer;
            if (!audioBuffer && currentState.greetingAudioPromise) {
              audioBuffer = await currentState.greetingAudioPromise;
            }
            if (!audioBuffer) {
              logger.error('=== DIRECT GREETING FALLBACK: NO AUDIO ===', { sessionId, callId });
              return;
            }
            logger.info('=== DIRECT GREETING FALLBACK: SENDING GREETING ===', { sessionId, callId, audioSize: audioBuffer.length });
            await telnyxMediaProvider.sendAudio(callId, audioBuffer);
            currentState.greetingSent = true;
            currentState.greetingFinished = true;
            this.agents.set(sessionId, currentState);
            logger.info('=== DIRECT GREETING FALLBACK: GREETING SENT ===', { sessionId, callId });
          }, 2500);
          
        } catch (error) {
          logger.error('=== FAILED TO START MEDIA STREAMING ===', { sessionId, callId, error });
        }
        break;

      case 'call.media_start':
      case 'call_media_start':
        logger.info('=== MEDIA START WEBHOOK (handled by WebSocket start event) ===', { sessionId, callId });
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
