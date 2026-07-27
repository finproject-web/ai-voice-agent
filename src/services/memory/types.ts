export interface MemoryEntry {
  id: string;
  sessionId: string;
  leadId?: string;
  key: string;
  value: any;
  timestamp: Date;
  expiresAt?: Date;
}

export interface ConversationMemory {
  sessionId: string;
  leadId?: string;
  phoneNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  extractedData: Record<string, any>;
  currentStage: string;
  customerIntent?: string;
  lastActivity: Date;
  createdAt: Date;
}

export interface MemoryOptions {
  ttl?: number; // Time to live in milliseconds
  persistToDatabase?: boolean;
}
