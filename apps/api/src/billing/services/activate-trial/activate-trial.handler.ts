import { singleton } from "tsyringe";

import { ActivateTrial } from "@src/billing/events/activate-trial";
import { TrialActivationInstrumentationService } from "@src/billing/services/activate-trial/trial-activation-instrumentation.service";
import { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import { JobHandler, JobPayload } from "@src/core";

@singleton()
export class ActivateTrialHandler implements JobHandler<ActivateTrial> {
  public readonly accepts = ActivateTrial;

  public readonly concurrency = 2;

  public readonly policy = "singleton";

  constructor(
    private readonly walletInitializer: WalletInitializerService,
    private readonly instrumentation: TrialActivationInstrumentationService
  ) {}

  async handle(payload: JobPayload<ActivateTrial>): Promise<void> {
    const startTime = Date.now();
    try {
      await this.walletInitializer.initializeAndGrantTrialLimits(payload.userId);
      this.instrumentation.recordJobSucceeded(payload.userId, Date.now() - startTime);
    } catch (error) {
      this.instrumentation.recordJobFailed(payload.userId, Date.now() - startTime, error);
      throw error;
    }
  }
}
