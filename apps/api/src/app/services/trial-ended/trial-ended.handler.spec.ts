import { mock } from "vitest-mock-extended";

import type { TrialEnded } from "@src/billing/events/trial-ended";
import type { EventPayload, LoggerService } from "@src/core";
import type { AccountStageService } from "@src/user/services/account-stage/account-stage.service";
import { TrialEndedHandler } from "./trial-ended.handler";

describe(TrialEndedHandler.name, () => {
  it("calls the bare advanceToRegular (NOT endTrial, to avoid re-publishing)", async () => {
    const { handler, accountStageService } = setup();

    await handler.handle({ userId: "user-1", version: 1 } as EventPayload<TrialEnded>);

    expect(accountStageService.advanceToRegular).toHaveBeenCalledWith("user-1");
    expect(accountStageService.endTrial).not.toHaveBeenCalled();
  });

  it("rethrows when advance fails so pg-boss retries", async () => {
    const { handler, accountStageService } = setup();
    accountStageService.advanceToRegular.mockRejectedValue(new Error("db down"));

    await expect(handler.handle({ userId: "user-1", version: 1 } as EventPayload<TrialEnded>)).rejects.toThrow("db down");
  });

  function setup() {
    const accountStageService = mock<AccountStageService>();
    const logger = mock<LoggerService>();
    const handler = new TrialEndedHandler(accountStageService, logger);
    return { handler, accountStageService, logger };
  }
});
