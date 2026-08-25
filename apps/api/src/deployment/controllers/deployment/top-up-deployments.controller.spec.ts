import "@test/mocks/logger-service.mock";

import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

import type { DeploymentSettingsBackfillService } from "@src/deployment/services/deployment-settings-backfill/deployment-settings-backfill.service";
import type { ExpiredDeploymentsCloserService } from "@src/deployment/services/expired-deployments-closer/expired-deployments-closer.service";
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

  describe("closeExpiredDeployments", () => {
    it("should call the service to close expired deployments", async () => {
      const { controller, expiredDeploymentsCloserService } = setup();
      const options = { dryRun: false };

      await controller.closeExpiredDeployments(options);

      expect(expiredDeploymentsCloserService.closeExpiredDeployments).toHaveBeenCalledWith(options);
    });
  });

  describe("backfillDeploymentSettings", () => {
    it("calls the service to backfill deployment settings", async () => {
      const { controller, deploymentSettingsBackfillService } = setup();
      const options = { dryRun: true };

      await controller.backfillDeploymentSettings(options);

      expect(deploymentSettingsBackfillService.backfillDeploymentSettings).toHaveBeenCalledWith(options);
    });
  });

  function setup(): {
    controller: TopUpDeploymentsController;
    topUpManagedDeploymentsService: MockProxy<TopUpManagedDeploymentsService>;
    staleDeploymentsCleanerService: MockProxy<StaleManagedDeploymentsCleanerService>;
    expiredDeploymentsCloserService: MockProxy<ExpiredDeploymentsCloserService>;
    deploymentSettingsBackfillService: MockProxy<DeploymentSettingsBackfillService>;
  } {
    const topUpManagedDeploymentsService = mock<TopUpManagedDeploymentsService>();
    const staleDeploymentsCleanerService = mock<StaleManagedDeploymentsCleanerService>();
    const expiredDeploymentsCloserService = mock<ExpiredDeploymentsCloserService>();
    const deploymentSettingsBackfillService = mock<DeploymentSettingsBackfillService>();
    const controller = new TopUpDeploymentsController(
      topUpManagedDeploymentsService,
      staleDeploymentsCleanerService,
      expiredDeploymentsCloserService,
      deploymentSettingsBackfillService
    );

    return {
      controller,
      topUpManagedDeploymentsService,
      staleDeploymentsCleanerService,
      expiredDeploymentsCloserService,
      deploymentSettingsBackfillService
    };
  }
});
