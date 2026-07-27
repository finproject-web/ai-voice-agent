import { EventEmitter } from 'events';
import { Event, EventType } from './event.types';
import logger from '../config/logger';

type EventHandler = (event: any) => Promise<void> | void;

class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(100); // Allow many listeners
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Publish an event
   */
  async publish(event: Event): Promise<void> {
    try {
      logger.info('Event published', { type: event.type, tenantId: event.tenantId });
      this.emit(event.type, event);
      this.emit('*', event); // Wildcard for all events
    } catch (error) {
      logger.error('Failed to publish event', { error, type: event.type });
      throw error;
    }
  }

  /**
   * Subscribe to an event type
   */
  subscribe(eventType: EventType, handler: EventHandler): void {
    this.on(eventType, handler);
    logger.info(`Event handler subscribed: ${eventType}`);
  }

  /**
   * Subscribe to all events (wildcard)
   */
  subscribeAll(handler: EventHandler): void {
    this.on('*', handler);
    logger.info('Wildcard event handler subscribed');
  }

  /**
   * Unsubscribe from an event type
   */
  unsubscribe(eventType: EventType, handler: EventHandler): void {
    this.off(eventType, handler);
    logger.info(`Event handler unsubscribed: ${eventType}`);
  }

  /**
   * Unsubscribe from all events
   */
  unsubscribeAll(handler: EventHandler): void {
    this.off('*', handler);
    logger.info('Wildcard event handler unsubscribed');
  }

  /**
   * Get event listener count
   */
  getListenerCount(eventType: EventType): number {
    return this.listenerCount(eventType);
  }

  /**
   * Clear all listeners for an event type
   */
  clearListeners(eventType?: EventType): void {
    if (eventType) {
      this.removeAllListeners(eventType);
      logger.info(`Cleared listeners for event: ${eventType}`);
    } else {
      this.removeAllListeners();
      logger.info('Cleared all event listeners');
    }
  }
}

export default EventBus.getInstance();
