export enum AgentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum AgentVoice {
  MALE_1 = 'MALE_1',
  MALE_2 = 'MALE_2',
  FEMALE_1 = 'FEMALE_1',
  FEMALE_2 = 'FEMALE_2',
  NEUTRAL = 'NEUTRAL',
}

export enum AgentLanguage {
  EN_US = 'en-US',
  EN_GB = 'en-GB',
  ES_ES = 'es-ES',
  FR_FR = 'fr-FR',
  DE_DE = 'de-DE',
}

export interface AgentConfig {
  voice: AgentVoice;
  language: AgentLanguage;
  systemPrompt: string;
  knowledgeBaseIds: string[];
  conversationState: string;
  transferRules: TransferRule[];
  emailTemplates: EmailTemplate[];
  followUpRules: FollowUpRule[];
  conversationGoals: ConversationGoal[];
  tools: string[];
  maxConversationDuration: number;
  allowInterruption: boolean;
  confidenceThreshold: number;
}

export interface TransferRule {
  condition: string;
  target: string;
  priority: number;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
  trigger: string;
}

export interface FollowUpRule {
  delay: number; // hours
  condition: string;
  template: string;
}

export interface ConversationGoal {
  name: string;
  description: string;
  priority: number;
  required: boolean;
}

export interface Agent {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: number;
  status: AgentStatus;
  config: AgentConfig;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMemory {
  agentId: string;
  callId: string;
  customerName: string;
  phone: string;
  email?: string;
  currentStage: string;
  interestLevel: 'high' | 'medium' | 'low';
  objections: string[];
  customFields: Record<string, any>;
  previousCalls: string[];
  conversationSummary: string;
  updatedAt: Date;
}
