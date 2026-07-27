import { ITool, ToolResult, ToolContext } from './tool.interface';
import { SendEmailTool } from './sendEmail.tool';
import { UpdateLeadTool } from './updateLead.tool';
import { TransferCallTool } from './transferCall.tool';
import { ScheduleCallbackTool } from './scheduleCallback.tool';
import { StoreTranscriptTool } from './storeTranscript.tool';
import { GenerateSummaryTool } from './generateSummary.tool';
import { UpdateCampaignTool } from './updateCampaign.tool';
import logger from '../config/logger';

class ToolRegistry {
  private tools: Map<string, ITool> = new Map();

  constructor() {
    this.registerTool(new SendEmailTool());
    this.registerTool(new UpdateLeadTool());
    this.registerTool(new TransferCallTool());
    this.registerTool(new ScheduleCallbackTool());
    this.registerTool(new StoreTranscriptTool());
    this.registerTool(new GenerateSummaryTool());
    this.registerTool(new UpdateCampaignTool());
  }

  registerTool(tool: ITool): void {
    this.tools.set(tool.name, tool);
    logger.info(`Tool registered: ${tool.name}`);
  }

  getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  async executeTool(
    name: string,
    context: ToolContext,
    params: any
  ): Promise<ToolResult> {
    const tool = this.getTool(name);

    if (!tool) {
      logger.error(`Tool not found: ${name}`);
      return {
        success: false,
        error: `Tool not found: ${name}`,
      };
    }

    logger.info(`Executing tool: ${name}`, { context, params });

    try {
      const result = await tool.execute(context, params);
      logger.info(`Tool executed: ${name}`, { success: result.success });
      return result;
    } catch (error) {
      logger.error(`Tool execution failed: ${name}`, { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async executeTools(
    executions: Array<{ name: string; params: any }>
  ): Promise<ToolResult[]> {
    const results = await Promise.all(
      executions.map(exec => this.executeTool(exec.name, {} as ToolContext, exec.params))
    );

    return results;
  }
}

export default new ToolRegistry();
