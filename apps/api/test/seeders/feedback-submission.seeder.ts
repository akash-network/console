import { faker } from "@faker-js/faker";

import type { FeedbackSubmissionOutput } from "@src/feedback/repositories/feedback-submission/feedback-submission.repository";

export function createFeedbackSubmission(overrides: Partial<FeedbackSubmissionOutput> = {}): FeedbackSubmissionOutput {
  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    organizationId: faker.string.uuid(),
    kind: "deployment_outcome",
    dseq: faker.string.numeric(8),
    outcome: "live",
    dismissed: false,
    rating: faker.number.int({ min: 1, max: 5 }),
    category: null,
    message: null,
    context: { isTrialing: false },
    classificationType: null,
    classificationSummary: null,
    sentimentScore: null,
    endedStuck: null,
    classifiedAt: null,
    themeId: null,
    createdAt: faker.date.recent(),
    ...overrides
  };
}
