import { context, trace } from "@opentelemetry/api";
import { singleton } from "tsyringe";

import { OnboardingStarted } from "@src/billing/events/onboarding-started";
import { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import { EventPayload, JobHandler, LoggerService } from "@src/core";
import { withSpan } from "@src/core/services/tracing/tracing.service";

@singleton()
export class OnboardingStartedHandler implements JobHandler<OnboardingStarted> {
  public readonly accepts = OnboardingStarted;

  constructor(
    private readonly walletInitializer: WalletInitializerService,
    private readonly logger: LoggerService
  ) {}

  async handle(payload: EventPayload<OnboardingStarted>): Promise<void> {
    return withSpan("OnboardingStartedHandler.handle", async () => {
      const span = trace.getSpan(context.active());
      span?.setAttribute("user.id", payload.userId);

      this.logger.info({ event: "ONBOARDING_INIT_STARTED", userId: payload.userId });

      try {
        await this.walletInitializer.initializeForOnboarding(payload.userId);
        this.logger.info({ event: "ONBOARDING_INIT_SUCCEEDED", userId: payload.userId });
      } catch (error) {
        this.logger.error({ event: "ONBOARDING_INIT_FAILED", userId: payload.userId, error });
        throw error;
      }
    });
  }
}
