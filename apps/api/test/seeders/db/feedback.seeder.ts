import { faker } from "@faker-js/faker";
import { container } from "tsyringe";

import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";

type FeedbackSubmissionInsert = ApiPgTables["FeedbackSubmissions"]["$inferInsert"];
type FeedbackThemeInsert = ApiPgTables["FeedbackThemes"]["$inferInsert"];
type AssistantConversationInsert = ApiPgTables["AssistantConversations"]["$inferInsert"];
type AssistantMessageInsert = ApiPgTables["AssistantMessages"]["$inferInsert"];
type AssistantConsentInsert = ApiPgTables["AssistantConsents"]["$inferInsert"];

function db() {
  return container.resolve<ApiPgDatabase>(POSTGRES_DB);
}

export async function seedFeedbackSubmission(overrides: Partial<FeedbackSubmissionInsert> & Pick<FeedbackSubmissionInsert, "userId">) {
  const [submission] = await db()
    .insert(resolveTable("FeedbackSubmissions"))
    .values({
      kind: "deployment_outcome",
      dseq: faker.string.numeric(8),
      outcome: "live",
      rating: faker.number.int({ min: 1, max: 5 }),
      context: { isTrialing: false },
      ...overrides
    })
    .returning();

  return submission;
}

export async function seedFeedbackTheme(overrides: Partial<FeedbackThemeInsert> = {}) {
  const [theme] = await db()
    .insert(resolveTable("FeedbackThemes"))
    .values({ title: faker.lorem.sentence(), ...overrides })
    .returning();

  return theme;
}

export async function seedAssistantConversation(overrides: Partial<AssistantConversationInsert> & Pick<AssistantConversationInsert, "userId">) {
  const [conversation] = await db()
    .insert(resolveTable("AssistantConversations"))
    .values({ context: { isTrialing: false }, ...overrides })
    .returning();

  return conversation;
}

export async function seedAssistantMessage(overrides: Partial<AssistantMessageInsert> & Pick<AssistantMessageInsert, "conversationId">) {
  const [message] = await db()
    .insert(resolveTable("AssistantMessages"))
    .values({ role: "user", content: faker.lorem.sentence(), ...overrides })
    .returning();

  return message;
}

export async function seedAssistantConsent(overrides: Partial<AssistantConsentInsert> & Pick<AssistantConsentInsert, "userId">) {
  const [consent] = await db()
    .insert(resolveTable("AssistantConsents"))
    .values({ copyVersion: "2026-11-01", processingAcceptedAt: new Date(), ...overrides })
    .returning();

  return consent;
}
