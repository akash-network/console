import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivateTrial } from "@src/billing/events/activate-trial";
import type { TrialActivationInstrumentationService } from "@src/billing/services/activate-trial/trial-activation-instrumentation.service";
import type { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import type { JobPayload } from "@src/core";
import { ActivateTrialHandler } from "./activate-trial.handler";

describe(ActivateTrialHandler.name, () => {
  describe("handle", () => {
    it("initializes and grants trial limits for the payload user", async () => {
      const { handler, walletInitializer, payload } = setup();

      await handler.handle(payload);

      expect(walletInitializer.initializeAndGrantTrialLimits).toHaveBeenCalledWith(payload.userId);
    });

    it("records a successful outcome with its duration", async () => {
      const { handler, instrumentation, payload } = setup();

      await handler.handle(payload);

      expect(instrumentation.recordJobSucceeded).toHaveBeenCalledWith(payload.userId, expect.any(Number));
      expect(instrumentation.recordJobFailed).not.toHaveBeenCalled();
    });

    it("records the failure and rethrows when activation fails", async () => {
      const error = new Error(faker.lorem.sentence());
      const { handler, instrumentation, payload } = setup({ activationError: error });

      await expect(handler.handle(payload)).rejects.toThrow(error);

      expect(instrumentation.recordJobFailed).toHaveBeenCalledWith(payload.userId, expect.any(Number), error);
      expect(instrumentation.recordJobSucceeded).not.toHaveBeenCalled();
    });
  });

  function setup(input?: { activationError?: Error }) {
    const walletInitializer = mock<WalletInitializerService>();
    if (input?.activationError) {
      walletInitializer.initializeAndGrantTrialLimits.mockRejectedValue(input.activationError);
    }
    const instrumentation = mock<TrialActivationInstrumentationService>();
    const handler = new ActivateTrialHandler(walletInitializer, instrumentation);
    const payload: JobPayload<ActivateTrial> = { userId: faker.string.uuid(), version: 1 };

    return { handler, walletInitializer, instrumentation, payload };
  }
});
