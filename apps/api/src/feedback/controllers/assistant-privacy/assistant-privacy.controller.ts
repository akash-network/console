import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type {
  AssistantPrivacyResponse,
  DeleteAssistantConversationsResponse,
  UpdateAssistantConsentRequest
} from "@src/feedback/http-schemas/assistant-privacy.schema";
import { AssistantConsentService } from "@src/feedback/services/assistant-consent/assistant-consent.service";
import { FeedbackErasureService } from "@src/feedback/services/feedback-erasure/feedback-erasure.service";

@singleton()
export class AssistantPrivacyController {
  constructor(
    private readonly assistantConsentService: AssistantConsentService,
    private readonly feedbackErasureService: FeedbackErasureService
  ) {}

  @Protected([{ action: "read", subject: "AssistantConsent" }])
  async getConsent(): Promise<AssistantPrivacyResponse> {
    return { data: await this.assistantConsentService.getPrivacy() };
  }

  @Protected([{ action: "create", subject: "AssistantConsent" }])
  async updateConsent(input: UpdateAssistantConsentRequest["data"]): Promise<AssistantPrivacyResponse> {
    return { data: await this.assistantConsentService.updateConsent(input) };
  }

  @Protected([{ action: "delete", subject: "AssistantConversation" }])
  async deleteConversations(): Promise<DeleteAssistantConversationsResponse> {
    return { data: { deletedCount: await this.feedbackErasureService.eraseOwnConversations() } };
  }
}
