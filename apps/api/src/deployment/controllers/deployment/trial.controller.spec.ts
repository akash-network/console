import { mock } from "jest-mock-extended";

import type { TrialDeploymentsCleanerService } from "@src/deployment/services/trial-deployments-cleaner/trial-deployments-cleaner.service";
import { TrialController } from "./trial.controller";

describe("TrialController", () => {
  it("should call the trial deployments cleaner service with the provided options", async () => {
    const options = { concurrency: 5 };
    const { trialController, mockTrialDeploymentsCleanerService } = setup({ options });

    await trialController.cleanUpTrialDeployments(options);

    expect(mockTrialDeploymentsCleanerService.cleanup).toHaveBeenCalledWith(options);
  });

  it("should call the trial deployments cleaner service with default options when none provided", async () => {
    const { trialController, mockTrialDeploymentsCleanerService } = setup({ options: {} });

    await trialController.cleanUpTrialDeployments({});

    expect(mockTrialDeploymentsCleanerService.cleanup).toHaveBeenCalledWith({});
  });

  function setup(_input: { options: { concurrency?: number } }) {
    const mockTrialDeploymentsCleanerService = mock<TrialDeploymentsCleanerService>();
    const trialController = new TrialController(mockTrialDeploymentsCleanerService);

    return {
      trialController,
      mockTrialDeploymentsCleanerService
    };
  }
});
