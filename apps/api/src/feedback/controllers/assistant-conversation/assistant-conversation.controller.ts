import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type {
  CreateAssistantProblemReportRequest,
  CreateAssistantProblemReportResponse,
  EndAssistantConversationRequest,
  EndAssistantConversationResponse,
  RateAssistantTurnRequest,
  RateAssistantTurnResponse,
  RecordAssistantActionResultRequest,
  RecordAssistantActionResultResponse,
  SendAssistantMessageRequest,
  StartAssistantConversationRequest,
  StartAssistantConversationResponse,
  SubmitClientToolResultsRequest
} from "@src/feedback/http-schemas/assistant-conversation.schema";
import { AssistantConversationService, type RunAssistantTurn } from "@src/feedback/services/assistant-conversation/assistant-conversation.service";
import { AssistantProblemReportService } from "@src/feedback/services/assistant-problem-report/assistant-problem-report.service";

@singleton()
export class AssistantConversationController {
  constructor(
    private readonly assistantConversationService: AssistantConversationService,
    private readonly assistantProblemReportService: AssistantProblemReportService
  ) {}

  @Protected([{ action: "create", subject: "AssistantConversation" }])
  async start(input: StartAssistantConversationRequest["data"]): Promise<StartAssistantConversationResponse> {
    return { data: await this.assistantConversationService.start(input) };
  }

  @Protected([{ action: "create", subject: "AssistantConversation" }])
  async sendMessage(conversationId: string, input: SendAssistantMessageRequest["data"]): Promise<RunAssistantTurn> {
    return await this.assistantConversationService.prepareMessage(conversationId, input);
  }

  @Protected([{ action: "create", subject: "AssistantConversation" }])
  async submitClientToolResults(conversationId: string, input: SubmitClientToolResultsRequest["data"]): Promise<RunAssistantTurn> {
    return await this.assistantConversationService.prepareClientToolResults(conversationId, input);
  }

  @Protected([{ action: "update", subject: "AssistantConversation" }])
  async end(conversationId: string, input: EndAssistantConversationRequest["data"]): Promise<EndAssistantConversationResponse> {
    return { data: await this.assistantConversationService.end(conversationId, input) };
  }

  @Protected([{ action: "update", subject: "AssistantConversation" }])
  async recordActionResult(conversationId: string, input: RecordAssistantActionResultRequest["data"]): Promise<RecordAssistantActionResultResponse> {
    return { data: await this.assistantConversationService.recordActionResult(conversationId, input) };
  }

  @Protected([{ action: "update", subject: "AssistantConversation" }])
  async rateTurn(conversationId: string, turnId: string, input: RateAssistantTurnRequest["data"]): Promise<RateAssistantTurnResponse> {
    return { data: await this.assistantConversationService.rateTurn(conversationId, turnId, input) };
  }

  @Protected([{ action: "create", subject: "AssistantProblemReport" }])
  async reportProblem(conversationId: string, input: CreateAssistantProblemReportRequest["data"]): Promise<CreateAssistantProblemReportResponse> {
    return { data: await this.assistantProblemReportService.create(conversationId, input) };
  }
}
