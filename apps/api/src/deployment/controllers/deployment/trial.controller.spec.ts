import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";

import type { TrialDeploymentsCleanerService } from "@src/deployment/services/trial-deployments-cleaner/trial-deployments-cleaner.service";
import { TrialController } from "./trial.controller";

describe(TrialController.name, () => {
  describe("cleanUpTrialDeployments", () => {
    it("should call the trial deployments cleaner service with the provided options", async () => {
      const { controller, trialDeploymentsCleanerService } = setup();
      const options = { concurrency: 5 };

      await controller.cleanUpTrialDeployments(options);

      expect(trialDeploymentsCleanerService.cleanup).toHaveBeenCalledWith(options);
    });
  });

  function setup(): {
    controller: TrialController;
    trialDeploymentsCleanerService: MockProxy<TrialDeploymentsCleanerService>;
  } {
    const trialDeploymentsCleanerService = mock<TrialDeploymentsCleanerService>();
    const controller = new TrialController(trialDeploymentsCleanerService);

    return {
      controller,
      trialDeploymentsCleanerService
    };
  }
});
