import { mock } from "vitest-mock-extended";

import type { TrialActivated } from "@src/billing/events/trial-activated";
import type { EventPayload } from "@src/core";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import type { AccountStageService } from "@src/user/services/account-stage/account-stage.service";
import { TrialActivatedHandler } from "./trial-activated.handler";

import { createUser } from "@test/seeders/user.seeder";

describe(TrialActivatedHandler.name, () => {
  it("calls the bare advanceToTrial (NOT activateTrial, to avoid re-publishing)", async () => {
    const user = createUser({ id: "user-1", stage: "onboarding" });
    const { handler, userRepository, accountStageService } = setup();
    userRepository.findById.mockResolvedValue(user);

    await handler.handle({ userId: "user-1", version: 1 } as EventPayload<TrialActivated>);

    expect(accountStageService.advanceToTrial).toHaveBeenCalledWith(user);
    expect(accountStageService.activateTrial).not.toHaveBeenCalled();
  });

  it("no-ops when the user no longer exists", async () => {
    const { handler, userRepository, accountStageService } = setup();
    userRepository.findById.mockResolvedValue(undefined);

    await handler.handle({ userId: "ghost", version: 1 } as EventPayload<TrialActivated>);

    expect(accountStageService.advanceToTrial).not.toHaveBeenCalled();
  });

  it("rethrows when advance fails so pg-boss retries", async () => {
    const user = createUser({ id: "user-1", stage: "onboarding" });
    const { handler, userRepository, accountStageService } = setup();
    userRepository.findById.mockResolvedValue(user);
    accountStageService.advanceToTrial.mockRejectedValue(new Error("db down"));

    await expect(handler.handle({ userId: "user-1", version: 1 } as EventPayload<TrialActivated>)).rejects.toThrow("db down");
  });

  function setup() {
    const userRepository = mock<UserRepository>();
    const accountStageService = mock<AccountStageService>();
    const logger = mock<LoggerService>();
    const handler = new TrialActivatedHandler(userRepository, accountStageService, logger);
    return { handler, userRepository, accountStageService, logger };
  }
});
