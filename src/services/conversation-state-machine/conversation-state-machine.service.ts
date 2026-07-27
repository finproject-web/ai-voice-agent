import {
  ConversationStage,
  ConversationState,
  ObjectionType,
  ObjectionResponse,
  ApplicationGuidanceStep,
} from './types';
import logger from '../../config/logger';
import config from '../../config';

export class ConversationStateMachine {
  private states: Map<string, ConversationState> = new Map();
  private applicationGuidanceSteps: ApplicationGuidanceStep[] = [
    {
      step: 1,
      instruction: 'Select Loan Agent',
      helpText: 'If you need help, select Sophia as your loan assistant.',
    },
    {
      step: 2,
      instruction: 'Loan Amount',
      helpText: 'Choose the amount you need between two thousand and twenty-five thousand dollars.',
    },
    {
      step: 3,
      instruction: 'Loan Term',
      helpText: 'Choose how long you want payments spread out, from six to sixty months.',
    },
    {
      step: 4,
      instruction: 'Loan Purpose',
      helpText: 'Select the option that best matches your reason for requesting funds.',
    },
    {
      step: 5,
      instruction: 'Personal Information',
      helpText: 'Complete your identity and contact information for application review.',
    },
    {
      step: 6,
      instruction: 'Banking Information',
      helpText: 'Bank information is used for verification and funding purposes if approved.',
    },
    {
      step: 7,
      instruction: 'Bank Verification',
      helpText: 'Verification helps confirm account ownership and complete the standard review process.',
    },
    {
      step: 8,
      instruction: 'Loan Agreement',
      helpText: 'This agreement outlines the loan terms and authorization details.',
    },
    {
      step: 9,
      instruction: 'Digital Agreement',
      helpText: 'This confirms your electronic agreement to continue.',
    },
    {
      step: 10,
      instruction: 'Signature',
      helpText: 'You can complete your signature using your finger or mouse.',
    },
    {
      step: 11,
      instruction: 'Dashboard Password',
      helpText: 'This allows you to securely access your application dashboard.',
    },
  ];

  private objectionResponses: Map<ObjectionType, ObjectionResponse> = new Map([
    [
      ObjectionType.NOT_INTERESTED,
      {
        type: ObjectionType.NOT_INTERESTED,
        response: "That's completely okay. I just wanted to make sure you had the information available if your situation changes.",
        shouldEndCall: true,
      },
    ],
    [
      ObjectionType.BUSY,
      {
        type: ObjectionType.BUSY,
        response: "No problem. I can send the application link so you can review it when convenient.",
        shouldEndCall: false,
      },
    ],
    [
      ObjectionType.HOW_DID_YOU_GET_NUMBER,
      {
        type: ObjectionType.HOW_DID_YOU_GET_NUMBER,
        response: 'You recently submitted an online loan inquiry, and we are following up regarding your request.',
        shouldEndCall: false,
      },
    ],
  ]);

  constructor() {
    this.startCleanupInterval();
  }

  async initializeState(sessionId: string, phoneNumber: string): Promise<ConversationState> {
    const state: ConversationState = {
      sessionId,
      stage: ConversationStage.GREETING,
      phone: phoneNumber,
      startTime: new Date(),
      lastActivity: new Date(),
    };

    this.states.set(sessionId, state);
    logger.info('Conversation state initialized', { sessionId, stage: state.stage });
    return state;
  }

  getState(sessionId: string): ConversationState | undefined {
    return this.states.get(sessionId);
  }

  updateState(sessionId: string, updates: Partial<ConversationState>): void {
    const state = this.states.get(sessionId);
    if (state) {
      Object.assign(state, updates);
      state.lastActivity = new Date();
      this.states.set(sessionId, state);
      logger.info('Conversation state updated', { sessionId, updates });
    }
  }

  async processInput(sessionId: string, userInput: string): Promise<string> {
    const state = this.getState(sessionId);
    if (!state) {
      throw new Error('Conversation state not found');
    }

    state.lastActivity = new Date();

    // Check for objections
    const objection = this.detectObjection(userInput);
    if (objection) {
      const response = this.objectionResponses.get(objection);
      if (response) {
        if (response.shouldEndCall) {
          this.updateState(sessionId, { stage: ConversationStage.COMPLETED });
        }
        return response.response;
      }
    }

    // Process based on current stage
    switch (state.stage) {
      case ConversationStage.GREETING:
        return this.processGreeting(state, userInput);
      case ConversationStage.INTEREST_CONFIRMATION:
        return this.processInterestConfirmation(state, userInput);
      case ConversationStage.LOAN_QUALIFICATION:
        return this.processLoanQualification(state, userInput);
      case ConversationStage.EMAIL_VERIFICATION:
        return this.processEmailVerification(state, userInput);
      case ConversationStage.APPLICATION_EMAIL:
        return this.processApplicationEmail(state, userInput);
      case ConversationStage.APPLICATION_GUIDANCE:
        return this.processApplicationGuidance(state, userInput);
      default:
        return this.getStageResponse(state.stage);
    }
  }

  private processGreeting(state: ConversationState, userInput: string): string {
    const positiveResponses = ['yes', 'yeah', 'yep', 'correct', 'right', 'that\'s me'];
    const isPositive = positiveResponses.some((resp) =>
      userInput.toLowerCase().includes(resp)
    );

    if (isPositive) {
      this.updateState(state.sessionId, {
        stage: ConversationStage.INTEREST_CONFIRMATION,
      });
      return 'Just a quick call… because you recently applied for a loan online. Are you still looking for a loan today?';
    }

    return 'Am I speaking with the right person?';
  }

  private processInterestConfirmation(state: ConversationState, userInput: string): string {
    const positiveResponses = ['yes', 'yeah', 'yep', 'sure', 'interested', 'looking'];
    const isPositive = positiveResponses.some((resp) =>
      userInput.toLowerCase().includes(resp)
    );

    if (isPositive) {
      this.updateState(state.sessionId, {
        stage: ConversationStage.LOAN_QUALIFICATION,
        interested: true,
      });
      return 'What loan amount are you looking for today?';
    }

    const negativeResponses = ['no', 'not', 'not anymore', 'changed my mind'];
    const isNegative = negativeResponses.some((resp) =>
      userInput.toLowerCase().includes(resp)
    );

    if (isNegative) {
      this.updateState(state.sessionId, {
        stage: ConversationStage.COMPLETED,
        interested: false,
      });
      return "That's completely okay. I just wanted to make sure you had the information available if your situation changes.";
    }

    return 'Are you still looking for a loan today?';
  }

  private processLoanQualification(state: ConversationState, userInput: string): string {
    // Extract loan amount from input
    const amountMatch = userInput.match(/\$?(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/);
    if (amountMatch) {
      const amount = amountMatch[1].replace(/,/g, '');
      const numericAmount = parseFloat(amount);

      if (numericAmount >= 2000 && numericAmount <= 25000) {
        this.updateState(state.sessionId, {
          stage: ConversationStage.EMAIL_VERIFICATION,
          loanAmount: amount,
        });
        return `Okay, ${amount} dollars. I see we have your email on file. Is this still correct?`;
      } else {
        return 'Our loan amounts range from two thousand to twenty-five thousand dollars. What amount would you like?';
      }
    }

    return 'What loan amount are you looking for today? Our loans range from two thousand to twenty-five thousand dollars.';
  }

  private processEmailVerification(state: ConversationState, userInput: string): string {
    const positiveResponses = ['yes', 'yeah', 'yep', 'correct', 'right', 'that\'s it'];
    const isPositive = positiveResponses.some((resp) =>
      userInput.toLowerCase().includes(resp)
    );

    if (isPositive) {
      this.updateState(state.sessionId, {
        stage: ConversationStage.APPLICATION_EMAIL,
        emailVerified: true,
      });
      return 'Perfect… I\'ll send your secure application link right now.';
    }

    // Extract email from input
    const emailMatch = userInput.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      this.updateState(state.sessionId, {
        stage: ConversationStage.APPLICATION_EMAIL,
        email: emailMatch[0],
        emailVerified: true,
      });
      return `Perfect… I'll send your secure application link right now to ${emailMatch[0]}.`;
    }

    return 'What email would you like me to use for your application?';
  }

  private processApplicationEmail(state: ConversationState, _userInput: string): string {
    // This stage is for triggering the email send
    // The actual email sending is handled by the email service
    this.updateState(state.sessionId, {
      stage: ConversationStage.APPLICATION_GUIDANCE,
      emailSent: true,
      applicationGuidanceStep: 1,
    });
    return "You'll receive an email shortly from Up Start Loans with your secure application link. Let me guide you through the application process one step at a time.";
  }

  private processApplicationGuidance(state: ConversationState, userInput: string): string {
    const currentStep = state.applicationGuidanceStep || 1;
    const stepInfo = this.applicationGuidanceSteps.find((s) => s.step === currentStep);

    if (!stepInfo) {
      this.updateState(state.sessionId, {
        stage: ConversationStage.COMPLETED,
      });
      return 'Thank you for completing the application. Our team will review it and get back to you shortly. Have a great day!';
    }

    // Check if user needs help
    if (userInput.toLowerCase().includes('help') || userInput.toLowerCase().includes('stuck')) {
      return stepInfo.helpText || stepInfo.instruction;
    }

    // Move to next step
    const nextStep = currentStep + 1;
    const nextStepInfo = this.applicationGuidanceSteps.find((s) => s.step === nextStep);

    if (nextStepInfo) {
      this.updateState(state.sessionId, {
        applicationGuidanceStep: nextStep,
      });
      return nextStepInfo.instruction;
    } else {
      this.updateState(state.sessionId, {
        stage: ConversationStage.COMPLETED,
      });
      return 'Thank you for completing the application. Our team will review it and get back to you shortly. Have a great day!';
    }
  }

  private detectObjection(userInput: string): ObjectionType | null {
    const lowerInput = userInput.toLowerCase();

    if (lowerInput.includes('don\'t need') || lowerInput.includes('not interested') || lowerInput.includes('not looking')) {
      return ObjectionType.NOT_INTERESTED;
    }

    if (lowerInput.includes('busy') || lowerInput.includes('not now') || lowerInput.includes('bad time')) {
      return ObjectionType.BUSY;
    }

    if (lowerInput.includes('how did you get') || lowerInput.includes('where did you get') || lowerInput.includes('who gave you')) {
      return ObjectionType.HOW_DID_YOU_GET_NUMBER;
    }

    return null;
  }

  private getStageResponse(stage: ConversationStage): string {
    switch (stage) {
      case ConversationStage.GREETING:
        return 'Hi, this is Sophia from Up Start Loans. Am I speaking with you please?';
      case ConversationStage.INTEREST_CONFIRMATION:
        return 'Are you still looking for a loan today?';
      case ConversationStage.LOAN_QUALIFICATION:
        return 'What loan amount are you looking for today?';
      case ConversationStage.EMAIL_VERIFICATION:
        return 'Is your email still correct?';
      case ConversationStage.APPLICATION_EMAIL:
        return 'I\'ll send your secure application link right now.';
      case ConversationStage.APPLICATION_GUIDANCE:
        return 'Let me guide you through the application.';
      case ConversationStage.COMPLETED:
        return 'Thank you for your time. Have a great day!';
      case ConversationStage.TRANSFER:
        return 'Let me transfer you to a human agent who can better assist you.';
      default:
        return 'How can I help you today?';
    }
  }

  shouldTransferToHuman(state: ConversationState, userInput: string): boolean {
    const transferKeywords = ['human', 'person', 'agent', 'speak to someone', 'talk to someone'];
    const advancedKeywords = ['advanced', 'complex', 'special', 'custom', 'specific'];

    const lowerInput = userInput.toLowerCase();
    const wantsHuman = transferKeywords.some((keyword) => lowerInput.includes(keyword));
    const hasAdvancedQuestion = advancedKeywords.some((keyword) => lowerInput.includes(keyword));

    return wantsHuman || hasAdvancedQuestion || state.stage === ConversationStage.COMPLETED;
  }

  getTransferNumber(): string {
    return config.humanTransferNumber;
  }

  endConversation(sessionId: string): void {
    this.states.delete(sessionId);
    logger.info('Conversation ended', { sessionId });
  }

  private startCleanupInterval(): void {
    // Clean up inactive conversations every 5 minutes
    setInterval(() => {
      const now = new Date();
      const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

      for (const [sessionId, state] of this.states.entries()) {
        const inactiveTime = now.getTime() - state.lastActivity.getTime();
        if (inactiveTime > inactiveThreshold) {
          logger.info('Cleaning up inactive conversation', { sessionId, inactiveTime });
          this.states.delete(sessionId);
        }
      }
    }, 5 * 60 * 1000);
  }

  getAllStates(): ConversationState[] {
    return Array.from(this.states.values());
  }

  getActiveCount(): number {
    return this.states.size;
  }
}

export default new ConversationStateMachine();
