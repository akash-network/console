import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { DeletedClassifiedItems } from "@src/feedback/model-schemas";
import type { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import type { AssistantTurnTraceRepository } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
import type { FeedbackSubmissionRepository } from "@src/feedback/repositories/feedback-submission/feedback-submission.repository";
import type { FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import { FeedbackErasureService } from "./feedback-erasure.service";

import { createUser } from "@test/seeders/user.seeder";

describe(FeedbackErasureService.name, () => {
  describe("eraseOwnConversations", () => {
    it("deletes the signed-in user's conversations as their ability allows, recounts their themes and answers how many went", async () => {
      const { service, user, authService, assistantConversationRepository, feedbackThemeRepository } = setup({
        deletedConversations: { deletedCount: 3, themeIds: ["theme-1", "theme-2"] }
      });

      expect(await service.eraseOwnConversations()).toBe(3);
      expect(assistantConversationRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "delete");
      expect(assistantConversationRepository.deleteAllOf).toHaveBeenCalledWith(user.id);
      expect(feedbackThemeRepository.refreshCounts).toHaveBeenCalledWith(["theme-1", "theme-2"]);
    });

    it("erases the user's turn traces with their conversations", async () => {
      const { service, user, txService, assistantTurnTraceRepository } = setup();
      txService.transaction.mockImplementation(async cb => {
        const result = await cb();
        expect(assistantTurnTraceRepository.deleteAllOf).toHaveBeenCalledWith(user.id);
        return result;
      });

      expect(await service.eraseOwnConversations()).toBe(0);
      expect(assistantTurnTraceRepository.deleteAllOf).toHaveBeenCalledTimes(1);
    });

    it("keeps the feedback submissions", async () => {
      const { service, feedbackSubmissionRepository } = setup();

      await service.eraseOwnConversations();

      expect(feedbackSubmissionRepository.deleteAllOf).not.toHaveBeenCalled();
    });

    it("deletes and recounts inside one transaction", async () => {
      const { service, txService, feedbackThemeRepository } = setup();
      txService.transaction.mockImplementation(async cb => {
        const result = await cb();
        expect(feedbackThemeRepository.refreshCounts).toHaveBeenCalled();
        return result;
      });

      await service.eraseOwnConversations();

      expect(txService.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("eraseAccountFeedback", () => {
    it("deletes the account's submissions and conversations and recounts every theme they fed", async () => {
      const { service, assistantConversationRepository, feedbackSubmissionRepository, feedbackThemeRepository } = setup({
        deletedSubmissionThemeIds: ["theme-1"],
        deletedConversations: { deletedCount: 1, themeIds: ["theme-2"] }
      });

      await service.eraseAccountFeedback("user-1");

      expect(feedbackSubmissionRepository.deleteAllOf).toHaveBeenCalledWith("user-1");
      expect(assistantConversationRepository.deleteAllOf).toHaveBeenCalledWith("user-1");
      expect(assistantConversationRepository.accessibleBy).not.toHaveBeenCalled();
      expect(feedbackThemeRepository.refreshCounts).toHaveBeenCalledWith(["theme-1", "theme-2"]);
    });

    it("erases turn traces when the account's feedback is erased", async () => {
      const { service, txService, assistantTurnTraceRepository } = setup();
      txService.transaction.mockImplementation(async cb => {
        const result = await cb();
        expect(assistantTurnTraceRepository.deleteAllOf).toHaveBeenCalledWith("user-1");
        return result;
      });

      await service.eraseAccountFeedback("user-1");

      expect(assistantTurnTraceRepository.deleteAllOf).toHaveBeenCalledTimes(1);
    });

    it("deletes and recounts inside one transaction", async () => {
      const { service, txService, feedbackThemeRepository } = setup();
      txService.transaction.mockImplementation(async cb => {
        const result = await cb();
        expect(feedbackThemeRepository.refreshCounts).toHaveBeenCalled();
        return result;
      });

      await service.eraseAccountFeedback("user-1");

      expect(txService.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("eraseExpired", () => {
    it("deletes a bounded batch of inactive conversations and old submissions, recounts every theme they fed and answers how many went", async () => {
      const { service, assistantConversationRepository, feedbackSubmissionRepository, feedbackThemeRepository } = setup({
        inactiveConversations: { deletedCount: 2, themeIds: ["theme-1"] },
        expiredSubmissions: { deletedCount: 3, themeIds: ["theme-2", "theme-3"] }
      });
      const cutoff = new Date("2025-11-14T12:00:00.000Z");

      expect(await service.eraseExpired(cutoff, 50)).toEqual({ conversations: 2, submissions: 3 });
      expect(assistantConversationRepository.deleteInactiveBefore).toHaveBeenCalledWith(cutoff, 50);
      expect(feedbackSubmissionRepository.deleteCreatedBefore).toHaveBeenCalledWith(cutoff, 50);
      expect(feedbackThemeRepository.refreshCounts).toHaveBeenCalledWith(["theme-1", "theme-2", "theme-3"]);
    });

    it("leaves turn traces to their own retention", async () => {
      const { service, assistantTurnTraceRepository } = setup();

      await service.eraseExpired(new Date(), 50);

      expect(assistantTurnTraceRepository.deleteAllOf).not.toHaveBeenCalled();
    });

    it("deletes and recounts inside one transaction", async () => {
      const { service, txService, feedbackThemeRepository } = setup();
      txService.transaction.mockImplementation(async cb => {
        const result = await cb();
        expect(feedbackThemeRepository.refreshCounts).toHaveBeenCalled();
        return result;
      });

      await service.eraseExpired(new Date(), 50);

      expect(txService.transaction).toHaveBeenCalledTimes(1);
    });
  });

  function setup(
    input: {
      deletedSubmissionThemeIds?: string[];
      deletedConversations?: DeletedClassifiedItems;
      inactiveConversations?: DeletedClassifiedItems;
      expiredSubmissions?: DeletedClassifiedItems;
    } = {}
  ) {
    const user = createUser();
    const feedbackSubmissionRepository = mock<FeedbackSubmissionRepository>();
    feedbackSubmissionRepository.deleteAllOf.mockResolvedValue(input.deletedSubmissionThemeIds ?? []);
    feedbackSubmissionRepository.deleteCreatedBefore.mockResolvedValue(input.expiredSubmissions ?? { deletedCount: 0, themeIds: [] });
    const assistantConversationRepository = mock<AssistantConversationRepository>();
    assistantConversationRepository.accessibleBy.mockReturnValue(assistantConversationRepository);
    assistantConversationRepository.deleteAllOf.mockResolvedValue(input.deletedConversations ?? { deletedCount: 0, themeIds: [] });
    assistantConversationRepository.deleteInactiveBefore.mockResolvedValue(input.inactiveConversations ?? { deletedCount: 0, themeIds: [] });
    const feedbackThemeRepository = mock<FeedbackThemeRepository>();
    const assistantTurnTraceRepository = mock<AssistantTurnTraceRepository>();
    const authService = mock<AuthService>({ currentUser: user });
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());

    const service = new FeedbackErasureService(
      feedbackSubmissionRepository,
      assistantConversationRepository,
      feedbackThemeRepository,
      assistantTurnTraceRepository,
      authService,
      txService
    );

    return {
      service,
      user,
      authService,
      txService,
      feedbackSubmissionRepository,
      assistantConversationRepository,
      feedbackThemeRepository,
      assistantTurnTraceRepository
    };
  }
});
