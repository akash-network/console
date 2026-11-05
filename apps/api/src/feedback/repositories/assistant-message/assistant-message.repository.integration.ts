import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AssistantMessageRepository } from "./assistant-message.repository";

import { seedAssistantConversation, seedAssistantMessage } from "@test/seeders/db/feedback.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(AssistantMessageRepository.name, () => {
  describe("findAllOf", () => {
    it("answers the conversation's messages in the order they were written", async () => {
      const { repository, conversationId } = await setup();
      const other = await setup();
      const second = await seedAssistantMessage({ conversationId, role: "assistant", createdAt: new Date("2026-11-04T10:01:00.000Z") });
      const first = await seedAssistantMessage({ conversationId, role: "user", createdAt: new Date("2026-11-04T10:00:00.000Z") });
      await seedAssistantMessage({ conversationId: other.conversationId });

      const messages = await repository.findAllOf(conversationId);

      expect(messages.map(({ id }) => id)).toEqual([first.id, second.id]);
    });
  });

  async function setup() {
    const user = await seedUser();
    const conversation = await seedAssistantConversation({ userId: user.id });

    return { repository: container.resolve(AssistantMessageRepository), conversationId: conversation.id };
  }
});
