export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ToolContext {
  tenantId: string;
  userId?: string;
  callId?: string;
  leadId?: string;
  agentId?: string;
  metadata?: Record<string, any>;
}

export interface ITool {
  name: string;
  description: string;
  execute(context: ToolContext, params: any): Promise<ToolResult>;
}
