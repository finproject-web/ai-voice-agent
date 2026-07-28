import { IAIProvider } from '../../providers/ai/ai.interface';
import { OpenAIProvider } from '../../providers/ai/openai.provider';
import { NVIDIAProvider } from '../../providers/ai/nvidia.provider';
import logger from '../../config/logger';
import config from '../../config';
import {
  ConversationContext,
  ConversationEngineOptions,
  ConversationMessage,
  AIResponse,
  FunctionCall,
} from './types';

export class ConversationEngine {
  private aiProvider: IAIProvider;
  private contexts: Map<string, ConversationContext>;
  private options: ConversationEngineOptions;

  constructor(options?: ConversationEngineOptions) {
    // Use OpenAI if available, otherwise fall back to NVIDIA
    if (config.openaiApiKey) {
      this.aiProvider = new OpenAIProvider();
      this.options = {
        systemPrompt: options?.systemPrompt || '',
        model: options?.model || 'gpt-4o-mini',
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 100,
        enableMemory: options?.enableMemory ?? true,
        enableFunctionCalling: options?.enableFunctionCalling ?? true,
      };
    } else if (config.nvidiaApiKey) {
      this.aiProvider = new NVIDIAProvider();
      this.options = {
        systemPrompt: options?.systemPrompt || '',
        model: options?.model || 'meta/llama-3.1-405b-instruct',
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 100,
        enableMemory: options?.enableMemory ?? true,
        enableFunctionCalling: options?.enableFunctionCalling ?? true,
      };
    } else {
      throw new Error('No AI provider configured (OpenAI or NVIDIA API key required)');
    }

    this.contexts = new Map();
  }

  private buildSystemPrompt(context: ConversationContext): string {
    return [
      this.getBaseSystemRole(),
      this.getLeadDataSection(context),
      this.getConversationStateSection(context),
      this.getStageInstructions(context),
      this.getApplicationGuidance(),
      this.getToolsSection(),
      this.getSmsVoicemailSection(),
    ].join('\n\n');
  }

  private getBaseSystemRole(): string {
    return `========================
SYSTEM ROLE
========================

You are Sophia, a professional loan specialist for Up Start Loans.

You sound like a real human.
You are warm, confident, patient, and conversational.
You never say you are an AI.
You ask only one question at a time.
You wait for the customer before continuing.
You remember everything already discussed.
You never repeat completed questions.

Response style:
- Maximum two short sentences per turn.
- Natural pauses in speech.
- No long paragraphs.
- No robotic wording.
- Do not repeat greetings.
- Do not repeat questions already answered.
- Keep every response conversational.`;
  }

  private getLeadDataSection(context: ConversationContext): string {
    const name = context.customerName || 'Not on file';
    const email = context.customerEmail || 'Not on file';
    const phone = context.customerPhone || context.phoneNumber || 'Not on file';
    const status = context.extractedData?.status || 'Not on file';
    const workerSlot = context.extractedData?.worker_slot || 'Not assigned';
    const agentAssigned = context.extractedData?.Agent_Assigned || 'Not assigned';
    const callStatus = context.extractedData?.Call_Status || 'Not set';
    const processed = context.extractedData?.processed || 'No';

    return `========================
LEAD DATA (source of truth)
========================

Name: ${name}
Phone: ${phone}
Email: ${email}
Status: ${status}
Worker Slot: ${workerSlot}
Agent Assigned: ${agentAssigned}
Call Status: ${callStatus}
Processed: ${processed}

Never ask for name, phone, or email unless one of these values is missing above.
Use the customer's name naturally.`;
  }

  private getConversationStateSection(context: ConversationContext): string {
    const state = context.state || { currentStage: 'greeting' };
    const stage = context.currentStage || state.currentStage || 'greeting';

    return `========================
CONVERSATION STATES
========================

Allowed progression:
Greeting → Identity Confirmation → Interest Confirmation → Loan Amount → Email Confirmation → Send Application Email → Application Guidance → Completion → Transfer if needed

Current stage: ${stage}
Never restart from Greeting.
Never return to Interest once already confirmed.

Memory so far:
- interest_confirmed: ${state.interest_confirmed ? 'YES' : 'NO'}
- loan_amount: ${state.loan_amount || 'not collected'}
- email_confirmed: ${state.email_confirmed ? 'YES' : 'NO'}
- email_sent: ${state.email_sent ? 'YES' : 'NO'}
- application_started: ${state.application_started ? 'YES' : 'NO'}
- application_completed: ${state.application_completed ? 'YES' : 'NO'}
- customer_language: ${state.customer_language || 'en'}
- last_question: ${state.last_question || 'none'}

Never ask for information already collected above.`;
  }

  private getStageInstructions(context: ConversationContext): string {
    const name = context.customerName || 'the customer';
    const email = context.customerEmail || 'the email on file';
    const state = context.state || { currentStage: 'greeting' };
    const stage = state.currentStage || 'greeting';

    const opening = `OPENING (use exactly this for Greeting stage):
"Hi ${name}, this is Sophia from Up Start Loans. Am I speaking with ${name}? I'm calling because you recently applied for a loan and your application has been pre-qualified. Are you still looking for a loan today?"`;

    const emailBlock = context.customerEmail && context.customerEmail !== 'Not on file'
      ? `If the customer confirms, say: "I have your email as ${email}. Is that still correct?"`
      : `If no email is on file, ask: "Could you please provide your best email address so I can send the application link?"`;

    return `========================
STAGE INSTRUCTIONS
========================

You are currently in stage: ${stage}

${opening}

If customer is interested:
- Set intent: [STATE:interest_confirmed=true]
- Ask: "What loan amount are you looking for today?"

When loan amount is given:
- Set: [STATE:loan_amount=<amount>]
- Ask: ${emailBlock}

When email is confirmed:
- Set: [STATE:email_confirmed=true]
- Use tool: [TOOL:sendLoanEmail|email=${context.customerEmail || '<email>'}]
- Then guide the customer to start the application.

When customer is confused or silent:
- Wait. Do not keep talking.
- If the customer asks about a screen, give only the one matching step below.

If customer wants a human, says "transfer me" or "speak to a representative":
- Use tool: [TOOL:transferCall|to=4702063218]

If customer is ready to end:
- Use tool: [TOOL:endCall]`;
  }

  private getApplicationGuidance(): string {
    return `========================
APPLICATION GUIDANCE (ONE STEP AT A TIME)
========================

If a customer asks about a specific screen, reply with ONLY the matching step. Otherwise, only mention the current/next step they need.

STEP 1 — SELECT LOAN AGENT
"On that screen, you'll simply select my name, Sophia, as your loan assistant."

STEP 2 — LOAN AMOUNT
"You can choose any amount between two thousand and twenty-five thousand dollars depending on your needs."

STEP 3 — LOAN TERM
"The term is simply how long you'd like monthly payments spread out — anywhere from six to sixty months."

STEP 4 — LOAN PURPOSE
"Just choose the option that best matches what you plan to use the funds for."

STEP 5 — PERSONAL INFORMATION
"This section is just basic identity and contact verification used during the application review."

STEP 6 — BANK INFORMATION
If customer cannot find their bank name: "That's completely okay. Please select the 'Other' option at the bottom of the list. If the next screen asks again, simply choose 'Other' one more time and it will allow you to manually type your bank name."
If customer asks why bank info is needed: "We need your bank name, routing number, and account number so the loan company knows where to deposit your funds if you're approved. Without banking information, the system wouldn't be able to send the loan money to your account."
If customer is uncomfortable: "I completely understand. The information is used for deposit verification and funding purposes only. If your application is approved, this is the account where the funds would be deposited."
If customer hesitates: "Most customers complete this part in just a minute or two. I'm still here with you if you need help."

STEP 7 — BANK LOGIN / VERIFICATION
Use a slower, calmer, reassuring tone.
Why required: "Verification helps confirm account ownership, identity consistency, and funding eligibility before any loan disbursement can be authorized. Because loan funding is deposited electronically, the company must complete banking verification and compliance review before approval. It's simply part of the standard online verification and underwriting process."
If unsafe: "I completely understand why you'd ask that. Security is extremely important. The connection uses secure encrypted verification technology similar to what many financial institutions use for online verification. The verification access is used only for account confirmation and underwriting review purposes."
If they want to quit: "I completely respect that decision. My role is simply to help explain the process clearly so you feel comfortable before proceeding."
If nervous: "No worries at all. Take your time reviewing everything carefully. I'm simply here to help guide you through the process and answer questions along the way."

STEP 8 — LOAN AGREEMENT
"This is the standard loan authorization and disclosure agreement that outlines the terms, verification authorization, and application review process."

STEP 9 — DIGITAL AGREEMENT
"This step confirms that you electronically agree to proceed with the application review."

STEP 10 — SIGNATURE
"You can simply draw your normal signature using your finger or mouse to complete the authorization."

STEP 11 — DASHBOARD PASSWORD
"This password allows you to securely access your customer dashboard and check your application status later."

If customer slows down: "You're doing great — you're actually almost finished."
If customer sounds frustrated: "I completely understand. These applications can feel detailed sometimes, but you're very close now."
If customer pauses: "No rush at all. I'm still here with you."
If customer wants to quit near final: "You're already near the completion stage, and finishing now avoids restarting the process later."`;
  }

  private getToolsSection(): string {
    return `========================
TOOLS
========================

You MUST NOT perform actions yourself. Only request these backend tools by printing EXACT markers:

[TOOL:readLead]
[TOOL:updateLead|field=value|...]
[TOOL:sendLoanEmail|email=<email>]
[TOOL:updateGoogleSheet|field=value|...]
[TOOL:transferCall|to=4702063218]
[TOOL:endCall]

You may also update memory/state by printing markers:
[STATE:interest_confirmed=true]
[STATE:loan_amount=<value>]
[STATE:email_confirmed=true]
[STATE:email_sent=true]
[STATE:application_started=true]
[STATE:application_completed=true]
[STATE:currentStage=<stage>]
[STATE:customer_language=en|es]
[STATE:last_question=<text>]

Rules:
- Put ALL markers at the very end of your response, after the spoken text, each on its own line.
- Do NOT say the marker text out loud.
- The backend will execute the tool and update state.`;
  }

  private getSmsVoicemailSection(): string {
    return `========================
SMS / VOICEMAIL
========================

When sending SMS (only if requested):
"Up Start Loans: Complete your secure loan application here: https://upstarloans.vercel.app/ Reply STOP to opt out."

If voicemail is detected, use this exact voicemail:
"Hi, this is Sophia from Up Start Loans. I'm calling regarding your recent loan application. Good news — you've been pre-qualified and are eligible to continue with your loan offer. To move forward and finalize your funding, please give us a quick call back at 470-741-770. Again, that's 470-741-770. Once we speak, we can complete your final steps and get everything processed for you. Thank you and have a great day."`;
  }

  async createContext(sessionId: string, initialData?: Partial<ConversationContext>): Promise<ConversationContext> {
    const context: ConversationContext = {
      sessionId,
      messages: [],
      currentStage: 'greeting',
      extractedData: {},
      lastActivity: new Date(),
      state: { currentStage: 'greeting' },
      toolLog: [],
      ...initialData,
    };

    if (!context.state) {
      context.state = { currentStage: 'greeting' };
    }
    context.state.currentStage = context.currentStage || 'greeting';

    this.contexts.set(sessionId, context);
    logger.info('Conversation context created', { sessionId, customerName: initialData?.customerName, currentStage: context.state.currentStage });

    return context;
  }

  getContext(sessionId: string): ConversationContext | undefined {
    return this.contexts.get(sessionId);
  }

  async processMessage(
    sessionId: string,
    userMessage: string,
    metadata?: Record<string, any>
  ): Promise<AIResponse> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw new Error(`No context found for session: ${sessionId}`);
    }

    // Add user message to context
    const userMsg: ConversationMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      metadata,
    };

    context.messages.push(userMsg);
    context.lastActivity = new Date();

    // Build modular system prompt from conversation state and lead data
    const aiContext = {
      systemPrompt: this.buildSystemPrompt(context),
      model: this.options.model,
      temperature: this.options.temperature,
      maxTokens: this.options.maxTokens,
      messages: context.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    let response;
    try {
      response = await this.aiProvider.generateResponse(aiContext, userMessage);
    } catch (error) {
      logger.warn('AI generation failed, using fallback response', { sessionId, error });
      response = this.getFallbackResponse(context, userMessage);
    }

    // Parse tool/state markers from the raw response
    const parsed = this.parseResponseMarkers(response.content);

    // Update context state from [STATE:...] markers
    if (parsed.stateUpdates && Object.keys(parsed.stateUpdates).length > 0) {
      context.state = { ...context.state, ...parsed.stateUpdates };
      if (parsed.stateUpdates.currentStage) {
        context.currentStage = parsed.stateUpdates.currentStage;
      }
    }

    // Add assistant response (spoken text only) to context
    const assistantMsg: ConversationMessage = {
      role: 'assistant',
      content: parsed.spokenText,
      timestamp: new Date(),
      metadata: response.metadata,
    };

    context.messages.push(assistantMsg);
    context.lastActivity = new Date();

    // Update context
    this.contexts.set(sessionId, context);

    logger.info('Message processed', {
      sessionId,
      messageCount: context.messages.length,
      responseLength: parsed.spokenText.length,
      toolCalls: parsed.toolCalls.length,
      stateUpdates: Object.keys(parsed.stateUpdates || {}),
    });

    return {
      content: parsed.spokenText,
      functionCalls: parsed.toolCalls,
      metadata: { ...response.metadata, state: context.state },
    };
  }

  updateContext(sessionId: string, updates: Partial<ConversationContext>): void {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw new Error(`No context found for session: ${sessionId}`);
    }

    Object.assign(context, updates);
    context.lastActivity = new Date();
    this.contexts.set(sessionId, context);

    logger.info('Context updated', { sessionId, updates: Object.keys(updates) });
  }

  extractInformation(sessionId: string, fields: string[]): Record<string, any> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw new Error(`No context found for session: ${sessionId}`);
    }

    const extracted: Record<string, any> = {};

    // Simple extraction based on patterns (can be enhanced with AI)
    for (const field of fields) {
      const pattern = this.getExtractionPattern(field);
      const match = context.messages
        .map((m) => m.content)
        .join(' ')
        .match(pattern);

      if (match) {
        extracted[field] = match[1] || match[0];
      }
    }

    context.extractedData = { ...context.extractedData, ...extracted };
    this.contexts.set(sessionId, context);

    return extracted;
  }

  private getExtractionPattern(field: string): RegExp {
    const patterns: Record<string, RegExp> = {
      email: /[\w.-]+@[\w.-]+\.\w+/,
      phone: /\+?[\d\s-()]{10,}/,
      name: /(?:my name is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      company: /(?:at|from|work at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      amount: /\$?\s*[\d,]+(?:\.\d{2})?/,
    };

    return patterns[field] || new RegExp(field, 'gi');
  }

  detectIntent(sessionId: string): string {
    const context = this.contexts.get(sessionId);

    if (!context) {
      return 'unknown';
    }

    const lastMessage = context.messages[context.messages.length - 1];
    const content = lastMessage?.content.toLowerCase() || '';

    // Intent detection based on keywords
    if (content.includes('interested') || content.includes('yes') || content.includes('sure')) {
      return 'interest';
    }

    if (content.includes('not interested') || content.includes('no thank') || content.includes('not now')) {
      return 'not_interested';
    }

    if (content.includes('question') || content.includes('how') || content.includes('what') || content.includes('why')) {
      return 'question';
    }

    if (content.includes('expensive') || content.includes('cost') || content.includes('price')) {
      return 'price_concern';
    }

    if (content.includes('credit') || content.includes('score') || content.includes('bad credit')) {
      return 'credit_concern';
    }

    return 'unknown';
  }

  getConversationSummary(sessionId: string): string {
    const context = this.contexts.get(sessionId);

    if (!context) {
      return '';
    }

    return context.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
  }

  clearContext(sessionId: string): void {
    this.contexts.delete(sessionId);
    logger.info('Context cleared', { sessionId });
  }

  cleanupInactiveSessions(maxAgeMinutes: number = 30): void {
    const now = new Date();
    const maxAge = maxAgeMinutes * 60 * 1000;

    for (const [sessionId, context] of this.contexts.entries()) {
      const age = now.getTime() - context.lastActivity.getTime();
      if (age > maxAge) {
        this.contexts.delete(sessionId);
        logger.info('Inactive session cleaned up', { sessionId, age });
      }
    }
  }

  getActiveSessionCount(): number {
    return this.contexts.size;
  }

  private parseResponseMarkers(raw: string): {
    spokenText: string;
    toolCalls: FunctionCall[];
    stateUpdates: Record<string, any>;
  } {
    const lines = raw.split('\n');
    const spokenLines: string[] = [];
    const toolCalls: FunctionCall[] = [];
    const stateUpdates: Record<string, any> = {};

    const toolRegex = /^\[TOOL:(\w+)(?:\|([^\]]*))?\]$/;
    const stateRegex = /^\[STATE:([^=]+)=([^\]]*)\]$/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const toolMatch = trimmed.match(toolRegex);
      if (toolMatch) {
        const name = toolMatch[1];
        const paramsStr = toolMatch[2] || '';
        const params: Record<string, any> = {};
        if (paramsStr) {
          paramsStr.split('|').forEach((pair) => {
            const [key, ...rest] = pair.split('=');
            if (key) params[key.trim()] = rest.join('=').trim();
          });
        }
        toolCalls.push({ name, parameters: params });
        continue;
      }

      const stateMatch = trimmed.match(stateRegex);
      if (stateMatch) {
        const key = stateMatch[1].trim();
        let value: any = stateMatch[2].trim();
        if (value.toLowerCase() === 'true') value = true;
        else if (value.toLowerCase() === 'false') value = false;
        else if (!Number.isNaN(Number(value)) && value !== '') value = Number(value);
        stateUpdates[key] = value;
        continue;
      }

      spokenLines.push(line);
    }

    const spokenText = spokenLines.join('\n').trim();
    return { spokenText, toolCalls, stateUpdates };
  }

  private getFallbackResponse(context: ConversationContext, userMessage: string): AIResponse {
    const messageCount = context.messages.length;
    const lowerMessage = userMessage.toLowerCase();

    // First message - greeting
    if (messageCount <= 1) {
      return {
        content: "Hi, this is Sophia from Up Start Loans. Am I speaking with the right person?",
        metadata: { fallback: true, stage: 'greeting' }
      };
    }

    // Customer confirmed identity
    if (lowerMessage.includes('yes') || lowerMessage.includes('yeah') || lowerMessage.includes('correct')) {
      if (messageCount <= 3) {
        return {
          content: "Just a quick call because you recently applied for a loan online. Are you still looking for a loan today?",
          metadata: { fallback: true, stage: 'interest_check' }
        };
      }
      // Email confirmation
      return {
        content: "Perfect, I'll send your secure application link right now.",
        metadata: { fallback: true, stage: 'email_confirmation' }
      };
    }

    // Customer interested in loan
    if (lowerMessage.includes('interested') || lowerMessage.includes('looking') || lowerMessage.includes('want')) {
      return {
        content: "What loan amount are you looking for today?",
        metadata: { fallback: true, stage: 'loan_amount' }
      };
    }

    // Loan amount provided
    if (lowerMessage.includes('$') || /\d+/.test(lowerMessage)) {
      return {
        content: "Okay, I see we have your email on file. Is this still correct?",
        metadata: { fallback: true, stage: 'email_verification' }
      };
    }

    // Objections
    if (lowerMessage.includes('not interested') || lowerMessage.includes('don\'t need') || lowerMessage.includes('not looking')) {
      return {
        content: "That's completely okay. I just wanted to make sure you had the information available if your situation changes.",
        metadata: { fallback: true, stage: 'objection_handled' }
      };
    }

    if (lowerMessage.includes('busy') || lowerMessage.includes('not now') || lowerMessage.includes('bad time')) {
      return {
        content: "No problem. I can send the application link so you can review it when convenient.",
        metadata: { fallback: true, stage: 'follow_up' }
      };
    }

    if (lowerMessage.includes('human') || lowerMessage.includes('person') || lowerMessage.includes('agent')) {
      return {
        content: "I'll transfer you to a human agent right away.",
        metadata: { fallback: true, stage: 'transfer' }
      };
    }

    // Default fallback
    return {
      content: "I understand. Let me help you with your loan application. What loan amount are you looking for?",
      metadata: { fallback: true, stage: 'default' }
    };
  }
}
