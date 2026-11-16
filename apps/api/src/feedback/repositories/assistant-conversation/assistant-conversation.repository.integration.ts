import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { resolveTable } from "@src/core";
import { AssistantConversationRepository } from "./assistant-conversation.repository";

import { seedAssistantConversation, seedAssistantMessage, seedFeedbackTheme } from "@test/seeders/db/feedback.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { holdTransaction, waitForLockWait } from "@test/services/lock-wait";

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

  describe("deleteInactiveBefore", () => {
    it("deletes conversations whose last message is before the cutoff with their messages, keeps the one exactly at it and answers the themes", async () => {
      const { repository, userId, countMessagesOf } = await setup();
      const cutoff = new Date("2001-06-01T00:00:00.000Z");
      const theme = await seedFeedbackTheme();
      const inactive = await seedAssistantConversation({ userId, themeId: theme.id, lastMessageAt: new Date(cutoff.getTime() - 1) });
      await seedAssistantMessage({ conversationId: inactive.id });
      const atCutoff = await seedAssistantConversation({ userId, themeId: theme.id, lastMessageAt: cutoff });
      const startedLongAgo = await seedAssistantConversation({ userId, startedAt: new Date("2001-01-01T00:00:00.000Z"), lastMessageAt: new Date() });

      expect(await repository.deleteInactiveBefore(cutoff, 10)).toEqual({ deletedCount: 1, themeIds: [theme.id] });
      expect(await repository.findById(inactive.id)).toBeUndefined();
      expect(await countMessagesOf(inactive.id)).toBe(0);
      expect(await repository.findById(atCutoff.id)).toBeDefined();
      expect(await repository.findById(startedLongAgo.id)).toBeDefined();
    });

    it("deletes at most the given number, the longest inactive first", async () => {
      const { repository, userId } = await setup();
      const cutoff = new Date("2000-06-01T00:00:00.000Z");
      const oldest = await seedAssistantConversation({ userId, lastMessageAt: new Date("2000-01-01T00:00:00.000Z") });
      const older = await seedAssistantConversation({ userId, lastMessageAt: new Date("2000-02-01T00:00:00.000Z") });

      expect(await repository.deleteInactiveBefore(cutoff, 1)).toEqual({ deletedCount: 1, themeIds: [] });
      expect(await repository.findById(oldest.id)).toBeUndefined();
      expect(await repository.findById(older.id)).toBeDefined();
    });

    it("keeps a conversation that received a message while the delete waited for it", async () => {
      const { repository, userId, countMessagesOf } = await setup();
      const cutoff = new Date("1999-06-01T00:00:00.000Z");
      const resumed = await seedAssistantConversation({ userId, lastMessageAt: new Date("1999-01-01T00:00:00.000Z") });
      const writer = holdTransaction(async () => {
        await seedAssistantMessage({ conversationId: resumed.id });
        await repository.updateById(resumed.id, { lastMessageAt: new Date() });
      });
      await writer.held;

      const deleted = repository.deleteInactiveBefore(cutoff, 10);
      await waitForLockWait('delete from "assistant_conversations"%');
      writer.release();
      await writer.committed;

      expect(await deleted).toEqual({ deletedCount: 0, themeIds: [] });
      expect(await countMessagesOf(resumed.id)).toBe(1);
    });
  });

  describe("endOpen", () => {
    it("ends an open conversation once and answers nothing for one that already ended", async () => {
      const { repository, userId } = await setup();
      const conversation = await seedAssistantConversation({ userId });
      const endedAt = new Date("2026-11-04T12:00:00.000Z");

      expect(await repository.endOpen(conversation.id, { status: "resolved", resolvedByUser: true, endedAt })).toMatchObject({
        id: conversation.id,
        status: "resolved",
        resolvedByUser: true,
        endedAt
      });
      expect(await repository.endOpen(conversation.id, { status: "unresolved", resolvedByUser: false, endedAt: new Date() })).toBeUndefined();
      expect(await repository.findById(conversation.id)).toMatchObject({ status: "resolved", endedAt });
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
      const givenUp = await seedAssistantConversation({ userId, endedAt: new Date(), classificationFailedAt: new Date() });

      const ids = await repository.findUnclassifiedIds(idleSince, 1000);

      expect(ids.indexOf(quiet.id)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(quiet.id)).toBeLessThan(ids.indexOf(ended.id));
      expect(ids).not.toContain(active.id);
      expect(ids).not.toContain(classified.id);
      expect(ids).not.toContain(givenUp.id);
    });

    it("answers at most the given number of conversations", async () => {
      const { repository, userId } = await setup();
      await seedAssistantConversation({ userId, endedAt: new Date() });
      await seedAssistantConversation({ userId, endedAt: new Date() });

      expect(await repository.findUnclassifiedIds(new Date(), 1)).toHaveLength(1);
    });
  });

  describe("recordFailedClassification", () => {
    it("counts each failed attempt and gives up on the one that reaches the maximum", async () => {
      const { repository, userId } = await setup();
      const conversation = await seedAssistantConversation({ userId });

      expect(await repository.recordFailedClassification(conversation.id, 2)).toEqual({ attempts: 1, abandoned: false });
      expect(await repository.recordFailedClassification(conversation.id, 2)).toEqual({ attempts: 2, abandoned: true });
      expect(await repository.findById(conversation.id)).toMatchObject({ classificationAttempts: 2, classificationFailedAt: expect.any(Date) });
    });

    it("answers nothing for a conversation that is gone", async () => {
      const { repository } = await setup();

      expect(await repository.recordFailedClassification("00000000-0000-0000-0000-000000000000", 2)).toBeUndefined();
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
