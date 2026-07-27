export enum ConversationState {
  INITIAL = 'INITIAL',
  INTRODUCTION = 'INTRODUCTION',
  PERMISSION = 'PERMISSION',
  DISCOVERY = 'DISCOVERY',
  QUALIFICATION = 'QUALIFICATION',
  OBJECTION_HANDLING = 'OBJECTION_HANDLING',
  EMAIL_COLLECTION = 'EMAIL_COLLECTION',
  TRANSFER = 'TRANSFER',
  FOLLOW_UP = 'FOLLOW_UP',
  GOODBYE = 'GOODBYE',
}

export interface StateTransition {
  from: ConversationState;
  to: ConversationState;
  condition?: string;
}

export interface StateConfig {
  entryAction?: string;
  exitAction?: string;
  validation?: string;
  allowedTransitions: ConversationState[];
  timeout?: number; // seconds
  retryBehavior?: 'retry' | 'skip' | 'escalate';
}

export class ConversationStateMachine {
  private currentState: ConversationState = ConversationState.INITIAL;
  private stateHistory: ConversationState[] = [];
  private stateConfigs: Map<ConversationState, StateConfig>;

  constructor() {
    this.stateConfigs = new Map();
    this.initializeStateConfigs();
  }

  private initializeStateConfigs(): void {
    this.stateConfigs.set(ConversationState.INITIAL, {
      entryAction: 'greet_customer',
      allowedTransitions: [ConversationState.INTRODUCTION, ConversationState.PERMISSION],
      timeout: 30,
      retryBehavior: 'retry',
    });

    this.stateConfigs.set(ConversationState.INTRODUCTION, {
      entryAction: 'introduce_self',
      validation: 'customer_acknowledged',
      allowedTransitions: [ConversationState.PERMISSION, ConversationState.DISCOVERY],
      timeout: 60,
      retryBehavior: 'retry',
    });

    this.stateConfigs.set(ConversationState.PERMISSION, {
      entryAction: 'ask_permission',
      validation: 'permission_granted',
      allowedTransitions: [ConversationState.DISCOVERY, ConversationState.GOODBYE],
      timeout: 30,
      retryBehavior: 'skip',
    });

    this.stateConfigs.set(ConversationState.DISCOVERY, {
      entryAction: 'discover_needs',
      validation: 'needs_identified',
      allowedTransitions: [ConversationState.QUALIFICATION, ConversationState.OBJECTION_HANDLING],
      timeout: 120,
      retryBehavior: 'retry',
    });

    this.stateConfigs.set(ConversationState.QUALIFICATION, {
      entryAction: 'qualify_lead',
      validation: 'qualification_complete',
      allowedTransitions: [ConversationState.EMAIL_COLLECTION, ConversationState.OBJECTION_HANDLING, ConversationState.TRANSFER],
      timeout: 90,
      retryBehavior: 'retry',
    });

    this.stateConfigs.set(ConversationState.OBJECTION_HANDLING, {
      entryAction: 'handle_objection',
      validation: 'objection_resolved',
      allowedTransitions: [ConversationState.QUALIFICATION, ConversationState.EMAIL_COLLECTION, ConversationState.FOLLOW_UP],
      timeout: 60,
      retryBehavior: 'retry',
    });

    this.stateConfigs.set(ConversationState.EMAIL_COLLECTION, {
      entryAction: 'collect_email',
      validation: 'email_collected',
      allowedTransitions: [ConversationState.FOLLOW_UP, ConversationState.GOODBYE],
      timeout: 45,
      retryBehavior: 'retry',
    });

    this.stateConfigs.set(ConversationState.TRANSFER, {
      entryAction: 'transfer_call',
      validation: 'transfer_complete',
      allowedTransitions: [ConversationState.GOODBYE],
      timeout: 30,
      retryBehavior: 'escalate',
    });

    this.stateConfigs.set(ConversationState.FOLLOW_UP, {
      entryAction: 'schedule_follow_up',
      validation: 'follow_up_scheduled',
      allowedTransitions: [ConversationState.GOODBYE],
      timeout: 60,
      retryBehavior: 'retry',
    });

    this.stateConfigs.set(ConversationState.GOODBYE, {
      entryAction: 'say_goodbye',
      allowedTransitions: [],
      timeout: 15,
      retryBehavior: 'skip',
    });
  }

  getCurrentState(): ConversationState {
    return this.currentState;
  }

  getStateHistory(): ConversationState[] {
    return [...this.stateHistory];
  }

  getStateConfig(state: ConversationState): StateConfig | undefined {
    return this.stateConfigs.get(state);
  }

  canTransitionTo(newState: ConversationState): boolean {
    const currentConfig = this.stateConfigs.get(this.currentState);
    return currentConfig?.allowedTransitions.includes(newState) || false;
  }

  transitionTo(newState: ConversationState): boolean {
    if (!this.canTransitionTo(newState)) {
      return false;
    }

    // Execute exit action of current state
    const currentConfig = this.stateConfigs.get(this.currentState);
    if (currentConfig?.exitAction) {
      this.executeAction(currentConfig.exitAction);
    }

    // Update state
    this.stateHistory.push(this.currentState);
    this.currentState = newState;

    // Execute entry action of new state
    const newConfig = this.stateConfigs.get(newState);
    if (newConfig?.entryAction) {
      this.executeAction(newConfig.entryAction);
    }

    return true;
  }

  private executeAction(action: string): void {
    // This would trigger the actual action execution
    // For now, it's a placeholder for the action system
  }

  validateCurrentState(validationResult: boolean): boolean {
    const currentConfig = this.stateConfigs.get(this.currentState);
    
    if (!currentConfig?.validation) {
      return true; // No validation required
    }

    return validationResult;
  }

  handleTimeout(): ConversationState | null {
    const currentConfig = this.stateConfigs.get(this.currentState);
    
    if (!currentConfig?.retryBehavior) {
      return null;
    }

    switch (currentConfig.retryBehavior) {
      case 'retry':
        // Stay in current state and retry
        return this.currentState;
      case 'skip':
        // Move to next allowed state
        const nextStates = currentConfig.allowedTransitions;
        return nextStates.length > 0 ? nextStates[0] : null;
      case 'escalate':
        // Move to transfer state
        return ConversationState.TRANSFER;
      default:
        return null;
    }
  }

  reset(): void {
    this.currentState = ConversationState.INITIAL;
    this.stateHistory = [];
  }

  isComplete(): boolean {
    return this.currentState === ConversationState.GOODBYE;
  }

  getProgress(): number {
    const totalStates = Object.keys(ConversationState).length;
    const completedStates = this.stateHistory.length;
    return (completedStates / totalStates) * 100;
  }
}

export default ConversationStateMachine;
