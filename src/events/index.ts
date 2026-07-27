import eventBus from './event.bus';
import { registerLeadHandlers } from './handlers/lead.handlers';
import { registerCallHandlers } from './handlers/call.handlers';
import { registerUserHandlers } from './handlers/user.handlers';

// Register all event handlers
export function registerAllEventHandlers(): void {
  registerLeadHandlers();
  registerCallHandlers();
  registerUserHandlers();
}

// Export event bus and types
export {
  eventBus,
  EventType,
};

export * from './event.types';

export default eventBus;
