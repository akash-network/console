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

  async function setup() {
    const user = await seedUser();
    const repository = container.resolve(AssistantConversationRepository);
    const messages = resolveTable("AssistantMessages");
    const countMessagesOf = async (conversationId: string) =>
      (await repository.cursor.select().from(messages).where(eq(messages.conversationId, conversationId))).length;

    return { repository, userId: user.id, countMessagesOf };
  }
});
