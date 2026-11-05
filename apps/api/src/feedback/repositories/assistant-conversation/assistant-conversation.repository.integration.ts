import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { resolveTable } from "@src/core";
import { AssistantConversationRepository } from "./assistant-conversation.repository";

import { seedAssistantConversation, seedAssistantMessage, seedFeedbackTheme } from "@test/seeders/db/feedback.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(AssistantConversationRepository.name, () => {
  describe("deleteAllOf", () => {
    it("deletes only the user's conversations with their messages and answers the count and the themes they belonged to", async () => {
      const { repository, userId, countMessagesOf } = await setup();
      const other = await seedUser();
      const theme = await seedFeedbackTheme();
      const themed = await seedAssistantConversation({ userId, themeId: theme.id });
      await seedAssistantMessage({ conversationId: themed.id });
      await seedAssistantConversation({ userId });
      const kept = await seedAssistantConversation({ userId: other.id, themeId: theme.id });
      await seedAssistantMessage({ conversationId: kept.id });

      expect(await repository.deleteAllOf(userId)).toEqual({ deletedCount: 2, themeIds: [theme.id] });
      expect(await repository.count({ userId })).toBe(0);
      expect(await countMessagesOf(themed.id)).toBe(0);
      expect(await repository.count({ userId: other.id })).toBe(1);
      expect(await countMessagesOf(kept.id)).toBe(1);
    });
  });

  describe("findUnclassifiedIds", () => {
    it("answers unclassified conversations that ended or went quiet, oldest first", async () => {
      const { repository, userId } = await setup();
      const idleSince = new Date("2026-11-04T12:00:00.000Z");
      const ended = await seedAssistantConversation({
        userId,
        endedAt: new Date(),
        lastMessageAt: new Date(),
        startedAt: new Date("2020-01-02T00:00:00.000Z")
      });
      const quiet = await seedAssistantConversation({
        userId,
        lastMessageAt: new Date("2026-11-04T11:00:00.000Z"),
        startedAt: new Date("2020-01-01T00:00:00.000Z")
      });
      const active = await seedAssistantConversation({ userId, lastMessageAt: new Date("2026-11-04T12:30:00.000Z") });
      const classified = await seedAssistantConversation({ userId, endedAt: new Date(), classifiedAt: new Date() });

      const ids = await repository.findUnclassifiedIds(idleSince, 1000);

      expect(ids.indexOf(quiet.id)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(quiet.id)).toBeLessThan(ids.indexOf(ended.id));
      expect(ids).not.toContain(active.id);
      expect(ids).not.toContain(classified.id);
    });

    it("answers at most the given number of conversations", async () => {
      const { repository, userId } = await setup();
      await seedAssistantConversation({ userId, endedAt: new Date() });
      await seedAssistantConversation({ userId, endedAt: new Date() });

      expect(await repository.findUnclassifiedIds(new Date(), 1)).toHaveLength(1);
    });
  });

  async function setup() {
    const user = await seedUser();
    const repository = container.resolve(AssistantConversationRepository);
    const messages = resolveTable("AssistantMessages");
    const countMessagesOf = async (conversationId: string) =>
      (await repository.cursor.select().from(messages).where(eq(messages.conversationId, conversationId))).length;

    return { repository, userId: user.id, countMessagesOf };
  }
});
