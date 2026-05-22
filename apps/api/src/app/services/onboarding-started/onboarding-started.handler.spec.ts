import { mock } from "vitest-mock-extended";

import type { OnboardingStarted } from "@src/billing/events/onboarding-started";
import type { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import type { EventPayload, LoggerService } from "@src/core";
import { OnboardingStartedHandler } from "./onboarding-started.handler";

describe(OnboardingStartedHandler.name, () => {
  it("delegates to walletInitializer.initializeForOnboarding with the userId", async () => {
    const { handler, walletInitializer } = setup();

    await handler.handle({ userId: "user-1", version: 1 } as EventPayload<OnboardingStarted>);

    expect(walletInitializer.initializeForOnboarding).toHaveBeenCalledWith("user-1");
  });

  it("propagates errors so pg-boss retries", async () => {
    const { handler, walletInitializer } = setup();
    walletInitializer.initializeForOnboarding.mockRejectedValue(new Error("chain down"));

    await expect(handler.handle({ userId: "user-1", version: 1 } as EventPayload<OnboardingStarted>)).rejects.toThrow("chain down");
  });

  function setup() {
    const walletInitializer = mock<WalletInitializerService>();
    const logger = mock<LoggerService>();
    const handler = new OnboardingStartedHandler(walletInitializer, logger);
    return { handler, walletInitializer, logger };
  }
});
