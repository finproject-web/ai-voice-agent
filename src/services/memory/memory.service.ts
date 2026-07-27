import { ConversationMemory, MemoryEntry, MemoryOptions } from './types';
import logger from '../../config/logger';

export class MemoryService {
  private memory: Map<string, ConversationMemory>;
  private entries: Map<string, MemoryEntry>;
  private defaultOptions: MemoryOptions;

  constructor(options?: MemoryOptions) {
    this.memory = new Map();
    this.entries = new Map();
    this.defaultOptions = {
      ttl: options?.ttl || 30 * 60 * 1000, // 30 minutes default
      persistToDatabase: options?.persistToDatabase ?? false,
    };
  }

  async createConversationMemory(
    sessionId: string,
    initialData?: Partial<ConversationMemory>
  ): Promise<ConversationMemory> {
    const memory: ConversationMemory = {
      sessionId,
      messages: [],
      extractedData: {},
      currentStage: 'greeting',
      lastActivity: new Date(),
      createdAt: new Date(),
      ...initialData,
    };

    this.memory.set(sessionId, memory);
    logger.info('Conversation memory created', { sessionId });

    return memory;
  }

  getConversationMemory(sessionId: string): ConversationMemory | undefined {
    return this.memory.get(sessionId);
  }

  async updateConversationMemory(
    sessionId: string,
    updates: Partial<ConversationMemory>
  ): Promise<void> {
    const memory = this.memory.get(sessionId);

    if (!memory) {
      throw new Error(`No memory found for session: ${sessionId}`);
    }

    Object.assign(memory, updates);
    memory.lastActivity = new Date();
    this.memory.set(sessionId, memory);

    logger.info('Conversation memory updated', { sessionId, updates: Object.keys(updates) });
  }

  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    const memory = this.memory.get(sessionId);

    if (!memory) {
      throw new Error(`No memory found for session: ${sessionId}`);
    }

    memory.messages.push({
      role,
      content,
      timestamp: new Date(),
    });

    memory.lastActivity = new Date();
    this.memory.set(sessionId, memory);

    logger.debug('Message added to memory', { sessionId, role, contentLength: content.length });
  }

  async setExtractedData(sessionId: string, key: string, value: any): Promise<void> {
    const memory = this.memory.get(sessionId);

    if (!memory) {
      throw new Error(`No memory found for session: ${sessionId}`);
    }

    memory.extractedData[key] = value;
    memory.lastActivity = new Date();
    this.memory.set(sessionId, memory);

    logger.debug('Extracted data set', { sessionId, key });
  }

  getExtractedData(sessionId: string, key?: string): any {
    const memory = this.memory.get(sessionId);

    if (!memory) {
      return undefined;
    }

    if (key) {
      return memory.extractedData[key];
    }

    return memory.extractedData;
  }

  async setEntry(
    sessionId: string,
    key: string,
    value: any,
    options?: MemoryOptions
  ): Promise<void> {
    const entryId = `${sessionId}:${key}`;
    const opts = { ...this.defaultOptions, ...options };

    const entry: MemoryEntry = {
      id: entryId,
      sessionId,
      key,
      value,
      timestamp: new Date(),
      expiresAt: opts.ttl ? new Date(Date.now() + opts.ttl) : undefined,
    };

    this.entries.set(entryId, entry);

    logger.debug('Memory entry set', { sessionId, key });
  }

  getEntry(sessionId: string, key: string): any {
    const entryId = `${sessionId}:${key}`;
    const entry = this.entries.get(entryId);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (entry.expiresAt && new Date() > entry.expiresAt) {
      this.entries.delete(entryId);
      return undefined;
    }

    return entry.value;
  }

  async clearConversationMemory(sessionId: string): Promise<void> {
    this.memory.delete(sessionId);

    // Clear all entries for this session
    for (const [entryId, entry] of this.entries.entries()) {
      if (entry.sessionId === sessionId) {
        this.entries.delete(entryId);
      }
    }

    logger.info('Conversation memory cleared', { sessionId });
  }

  async cleanupExpiredMemories(): Promise<void> {
    const now = new Date();
    let cleanedCount = 0;

    // Clean expired conversation memories
    for (const [sessionId, memory] of this.memory.entries()) {
      const age = now.getTime() - memory.lastActivity.getTime();
      const ttl = this.defaultOptions.ttl || 30 * 60 * 1000;
      if (age > ttl) {
        this.memory.delete(sessionId);
        cleanedCount++;
      }
    }

    // Clean expired entries
    for (const [entryId, entry] of this.entries.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.entries.delete(entryId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Expired memories cleaned up', { count: cleanedCount });
    }
  }

  getConversationHistory(sessionId: string): string {
    const memory = this.memory.get(sessionId);

    if (!memory) {
      return '';
    }

    return memory.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
  }

  getActiveSessionCount(): number {
    return this.memory.size;
  }

  getAllSessions(): string[] {
    return Array.from(this.memory.keys());
  }
}
