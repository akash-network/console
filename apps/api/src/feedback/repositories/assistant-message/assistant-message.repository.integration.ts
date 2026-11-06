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

  describe("findProposal", () => {
    it("finds a proposal of the conversation by its id, never an action result naming it", async () => {
      const { repository, conversationId } = await setup();
      const other = await setup();
      const proposalId = "6f1f4b62-0a8c-4b8e-9a54-0c6b1a7d5c11";
      await seedAssistantMessage({ conversationId, role: "tool", toolName: "action_result", toolPayload: { proposalId } });
      const proposal = await seedAssistantMessage({ conversationId, role: "tool", toolName: "propose_close_deployment", toolPayload: { proposalId } });
      await seedAssistantMessage({ conversationId: other.conversationId, role: "tool", toolName: "propose_buy_credits", toolPayload: { proposalId: "other" } });

      expect((await repository.findProposal(conversationId, proposalId))?.id).toBe(proposal.id);
      expect(await repository.findProposal(other.conversationId, proposalId)).toBeUndefined();
      expect(await repository.findProposal(conversationId, "other")).toBeUndefined();
    });
  });

  async function setup() {
    const user = await seedUser();
    const conversation = await seedAssistantConversation({ userId: user.id });

    return { repository: container.resolve(AssistantMessageRepository), conversationId: conversation.id };
  }
});
