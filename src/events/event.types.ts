export enum EventType {
  // Lead Events
  LEAD_CREATED = 'LeadCreated',
  LEAD_IMPORTED = 'LeadImported',
  LEAD_ASSIGNED = 'LeadAssigned',
  LEAD_QUALIFIED = 'LeadQualified',
  LEAD_REJECTED = 'LeadRejected',
  LEAD_UPDATED = 'LeadUpdated',
  LEAD_DELETED = 'LeadDeleted',

  // Campaign Events
  CAMPAIGN_STARTED = 'CampaignStarted',
  CAMPAIGN_PAUSED = 'CampaignPaused',
  CAMPAIGN_RESUMED = 'CampaignResumed',
  CAMPAIGN_COMPLETED = 'CampaignCompleted',
  CAMPAIGN_DELETED = 'CampaignDeleted',
  CAMPAIGN_UPDATED = 'CampaignUpdated',

  // Call Events
  CALL_INITIATED = 'CallInitiated',
  CALL_ANSWERED = 'CallAnswered',
  CALL_CONNECTED = 'CallConnected',
  CALL_TRANSFERRED = 'CallTransferred',
  CALL_ENDED = 'CallEnded',
  CALL_FAILED = 'CallFailed',
  CALL_NO_ANSWER = 'CallNoAnswer',
  CALL_BUSY = 'CallBusy',

  // Conversation Events
  TRANSCRIPT_READY = 'TranscriptReady',
  CONVERSATION_COMPLETED = 'ConversationCompleted',
  CONVERSATION_STARTED = 'ConversationStarted',

  // Telnyx Media Events
  TELNYX_AUDIO_RECEIVED = 'TelnyxAudioReceived',
  TELNYX_MEDIA_CONNECTED = 'TelnyxMediaConnected',
  TELNYX_MEDIA_DISCONNECTED = 'TelnyxMediaDisconnected',

  // AI Events
  AI_RESPONSE_GENERATED = 'AIResponseGenerated',
  AI_SUMMARY_GENERATED = 'AISummaryGenerated',
  AI_EXTRACTION_COMPLETED = 'AIExtractionCompleted',

  // Email Events
  EMAIL_SENT = 'EmailSent',
  EMAIL_FAILED = 'EmailFailed',
  EMAIL_OPENED = 'EmailOpened',
  EMAIL_CLICKED = 'EmailClicked',

  // User Events
  USER_LOGIN = 'UserLogin',
  USER_LOGOUT = 'UserLogout',
  USER_LOGIN_FAILED = 'UserLoginFailed',
  USER_CREATED = 'UserCreated',
  USER_UPDATED = 'UserUpdated',
  USER_DELETED = 'UserDeleted',

  // System Events
  WEBHOOK_RECEIVED = 'WebhookReceived',
  WEBHOOK_PROCESSED = 'WebhookProcessed',
  WEBHOOK_FAILED = 'WebhookFailed',
  QUEUE_JOB_COMPLETED = 'QueueJobCompleted',
  QUEUE_JOB_FAILED = 'QueueJobFailed',
  ERROR_OCCURRED = 'ErrorOccurred',
}

export interface BaseEvent {
  type: EventType;
  tenantId: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface LeadCreatedEvent extends BaseEvent {
  type: EventType.LEAD_CREATED;
  leadId: string;
  leadData: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    company?: string;
  };
}

export interface CallInitiatedEvent extends BaseEvent {
  type: EventType.CALL_INITIATED;
  callId: string;
  leadId: string;
  campaignId?: string;
  phoneNumber: string;
}

export interface CallAnsweredEvent extends BaseEvent {
  type: EventType.CALL_ANSWERED;
  callId: string;
  leadId: string;
  answeredAt: Date;
}

export interface CallEndedEvent extends BaseEvent {
  type: EventType.CALL_ENDED;
  callId: string;
  leadId: string;
  duration: number;
  status: string;
  endedAt: Date;
}

export interface TranscriptReadyEvent extends BaseEvent {
  type: EventType.TRANSCRIPT_READY;
  callId: string;
  conversationId: string;
  transcript: string;
}

export interface EmailSentEvent extends BaseEvent {
  type: EventType.EMAIL_SENT;
  emailId: string;
  to: string;
  subject: string;
}

export interface UserLoginEvent extends BaseEvent {
  type: EventType.USER_LOGIN;
  userId: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

export type Event = BaseEvent | LeadCreatedEvent | CallInitiatedEvent | CallAnsweredEvent | CallEndedEvent | TranscriptReadyEvent | EmailSentEvent | UserLoginEvent;
