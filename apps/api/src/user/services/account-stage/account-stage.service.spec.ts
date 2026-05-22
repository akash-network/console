import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/core/providers/logging.provider";
import type { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import { AccountStageService } from "./account-stage.service";

import { createUser } from "@test/seeders/user.seeder";

describe(AccountStageService.name, () => {
  describe("advanceToTrial", () => {
    it("writes the stage transition", async () => {
      const { service, userRepository } = setup();
      const user = createUser({ id: "user-1", stage: "onboarding" });

      await service.advanceToTrial(user);

      expect(userRepository.advanceStage).toHaveBeenCalledWith("user-1", { from: "onboarding", to: "trial" });
    });

    it("skips when stage is already past onboarding", async () => {
      const { service, userRepository } = setup();
      const user = createUser({ stage: "regular" });

      await service.advanceToTrial(user);

      expect(userRepository.advanceStage).not.toHaveBeenCalled();
    });

    it("re-throws repository errors", async () => {
      const { service, userRepository } = setup();
      const user = createUser({ id: "user-1", stage: "onboarding" });
      userRepository.advanceStage.mockRejectedValue(new Error("db down"));

      await expect(service.advanceToTrial(user)).rejects.toThrow("db down");
    });
  });

  describe("advanceToRegular", () => {
    it("writes the stage transition for trial/trial_legacy → regular", async () => {
      const { service, userRepository } = setup();

      await service.advanceToRegular("user-1");

      expect(userRepository.advanceStage).toHaveBeenCalledWith("user-1", { from: ["trial", "trial_legacy"], to: "regular" });
    });

    it("re-throws repository errors", async () => {
      const { service, userRepository } = setup();
      userRepository.advanceStage.mockRejectedValue(new Error("db down"));

      await expect(service.advanceToRegular("user-1")).rejects.toThrow("db down");
    });
  });

  describe("activateTrial", () => {
    it("publishes TrialActivated with a 3s timeout when stage is onboarding", async () => {
      const { service, domainEvents } = setup();
      const user = createUser({ id: "user-1", stage: "onboarding" });
      domainEvents.publishAndAwait.mockResolvedValue({ status: "completed", jobId: "j1" });

      await service.activateTrial(user);

      expect(domainEvents.publishAndAwait).toHaveBeenCalledWith(expect.objectContaining({ name: "TrialActivated", data: { userId: "user-1" } }), {
        timeoutMs: 3000
      });
    });

    it("skips when stage is already past onboarding (no event published)", async () => {
      const { service, domainEvents } = setup();
      const user = createUser({ stage: "regular" });

      await service.activateTrial(user);

      expect(domainEvents.publishAndAwait).not.toHaveBeenCalled();
    });

    it("logs a warning but does not throw on non-completed outcomes", async () => {
      const { service, domainEvents, logger } = setup();
      const user = createUser({ id: "user-1", stage: "onboarding" });
      domainEvents.publishAndAwait.mockResolvedValue({ status: "timeout", jobId: "j1" });

      await expect(service.activateTrial(user)).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "ACCOUNT_STAGE_ACTIVATE_TRIAL_NOT_COMPLETED",
          userId: "user-1"
        })
      );
    });
  });

  describe("endTrial", () => {
    it("publishes TrialEnded with a 3s timeout", async () => {
      const { service, domainEvents } = setup();
      domainEvents.publishAndAwait.mockResolvedValue({ status: "completed", jobId: "j1" });

      await service.endTrial("user-1");

      expect(domainEvents.publishAndAwait).toHaveBeenCalledWith(expect.objectContaining({ name: "TrialEnded", data: { userId: "user-1" } }), {
        timeoutMs: 3000
      });
    });

    it("logs a warning but does not throw on non-completed outcomes", async () => {
      const { service, domainEvents, logger } = setup();
      domainEvents.publishAndAwait.mockResolvedValue({ status: "failed", jobId: "j1" });

      await expect(service.endTrial("user-1")).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "ACCOUNT_STAGE_END_TRIAL_NOT_COMPLETED",
          userId: "user-1"
        })
      );
    });
  });

  function setup() {
    const userRepository = mock<UserRepository>();
    const domainEvents = mock<DomainEventsService>();
    const logger = mock<LoggerService>();
    const service = new AccountStageService(userRepository, domainEvents, logger);
    return { service, userRepository, domainEvents, logger };
  }
});
