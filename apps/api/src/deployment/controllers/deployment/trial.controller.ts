import { singleton } from "tsyringe";

import { TrialDeploymentsCleanerService } from "@src/deployment/services/trial-deployments-cleaner/trial-deployments-cleaner.service";
import { CleanUpTrialDeploymentsParams } from "@src/deployment/types/trial-deployments";

@singleton()
export class TrialController {
  constructor(private readonly trialDeploymentsCleanerService: TrialDeploymentsCleanerService) {}

  async cleanUpTrialDeployments(options: CleanUpTrialDeploymentsParams) {
    await this.trialDeploymentsCleanerService.cleanup(options);
  }
}
