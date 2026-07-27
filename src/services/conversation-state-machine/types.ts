export enum ConversationStage {
  GREETING = 'GREETING',
  INTEREST_CONFIRMATION = 'INTEREST_CONFIRMATION',
  LOAN_QUALIFICATION = 'LOAN_QUALIFICATION',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  APPLICATION_EMAIL = 'APPLICATION_EMAIL',
  APPLICATION_GUIDANCE = 'APPLICATION_GUIDANCE',
  COMPLETED = 'COMPLETED',
  TRANSFER = 'TRANSFER',
}

export enum ObjectionType {
  NOT_INTERESTED = 'NOT_INTERESTED',
  BUSY = 'BUSY',
  HOW_DID_YOU_GET_NUMBER = 'HOW_DID_YOU_GET_NUMBER',
}

export interface ConversationState {
  sessionId: string;
  stage: ConversationStage;
  customerName?: string;
  email?: string;
  phone?: string;
  loanAmount?: string;
  interested?: boolean;
  emailVerified?: boolean;
  emailSent?: boolean;
  applicationGuidanceStep?: number;
  notes?: string;
  startTime: Date;
  lastActivity: Date;
}

export interface StageTransition {
  from: ConversationStage;
  to: ConversationStage;
  condition: (state: ConversationState, userInput: string) => boolean;
}

export interface ObjectionResponse {
  type: ObjectionType;
  response: string;
  shouldEndCall?: boolean;
  shouldTransfer?: boolean;
}

export interface ApplicationGuidanceStep {
  step: number;
  instruction: string;
  helpText?: string;
}
