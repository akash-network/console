import "@test/mocks/logger-service.mock";

import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";

import type { StaleManagedDeploymentsCleanerService } from "@src/deployment/services/stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";
import type { TopUpManagedDeploymentsService } from "@src/deployment/services/top-up-managed-deployments/top-up-managed-deployments.service";
import { TopUpDeploymentsController } from "./top-up-deployments.controller";

describe(TopUpDeploymentsController.name, () => {
  describe("topUpDeployments", () => {
    it("should call the service to top up deployments", async () => {
      const { controller, topUpManagedDeploymentsService } = setup();
      const options = { concurrency: 5, dryRun: false };

      await controller.topUpDeployments(options);

      expect(topUpManagedDeploymentsService.topUpDeployments).toHaveBeenCalledWith(options);
    });
  });

  describe("cleanUpStaleDeployment", () => {
    it("should call the service to clean up stale deployments", async () => {
      const { controller, staleDeploymentsCleanerService } = setup();
      const options = { concurrency: 5 };

      await controller.cleanUpStaleDeployment(options);

      expect(staleDeploymentsCleanerService.cleanup).toHaveBeenCalledWith(options);
    });
  });

  function setup(): {
    controller: TopUpDeploymentsController;
    topUpManagedDeploymentsService: MockProxy<TopUpManagedDeploymentsService>;
    staleDeploymentsCleanerService: MockProxy<StaleManagedDeploymentsCleanerService>;
  } {
    const topUpManagedDeploymentsService = mock<TopUpManagedDeploymentsService>();
    const staleDeploymentsCleanerService = mock<StaleManagedDeploymentsCleanerService>();
    const controller = new TopUpDeploymentsController(topUpManagedDeploymentsService, staleDeploymentsCleanerService);

    return {
      controller,
      topUpManagedDeploymentsService,
      staleDeploymentsCleanerService
    };
  }
});
