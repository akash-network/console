import { faker } from "@faker-js/faker";

import type { AssistantConversationOutput } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";

export function createAssistantConversation(overrides: Partial<AssistantConversationOutput> = {}): AssistantConversationOutput {
  const startedAt = faker.date.recent();

  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    organizationId: null,
    status: "open",
    resolvedByUser: null,
    context: { isTrialing: false },
    classificationType: null,
    classificationSummary: null,
    sentimentScore: null,
    endedStuck: null,
    classifiedAt: null,
    themeId: null,
    startedAt,
    lastMessageAt: startedAt,
    endedAt: null,
    ...overrides
  };
}
