import { faker } from "@faker-js/faker";

import type { AssistantProblemReportOutput } from "@src/feedback/repositories/assistant-problem-report/assistant-problem-report.repository";

export function createAssistantProblemReport(overrides: Partial<AssistantProblemReportOutput> = {}): AssistantProblemReportOutput {
  const createdAt = faker.date.recent();

  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    organizationId: null,
    conversationId: faker.string.uuid(),
    turnTraceId: null,
    note: null,
    transcript: null,
    consentCopyVersion: "2026-11-14",
    status: "new",
    classificationType: null,
    classificationSummary: null,
    sentimentScore: null,
    endedStuck: null,
    classifiedAt: null,
    classificationAttempts: 0,
    classificationFailedAt: null,
    themeId: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides
  };
}
