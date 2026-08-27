import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentCloseJobService } from "@src/deployment/services/deployment-close-job/deployment-close-job.service";
import type { ExpiringDeploymentsNotifierService } from "@src/deployment/services/expiring-deployments-notifier/expiring-deployments-notifier.service";
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

    it("reconciles close jobs for deployments already past their deadline", async () => {
      const { controller, deploymentCloseJobService } = setup();
      const options = { concurrency: 5, dryRun: false };

      await controller.topUpDeployments(options);

      expect(deploymentCloseJobService.reconcileExpired).toHaveBeenCalledWith(options);
    });

    it("reconciles close jobs even when the funding sweep fails", async () => {
      const { controller, topUpManagedDeploymentsService, deploymentCloseJobService } = setup();
      const error = new Error("chain rpc unavailable");
      topUpManagedDeploymentsService.topUpDeployments.mockRejectedValue(error);
      const options = { concurrency: 5, dryRun: false };

      await expect(controller.topUpDeployments(options)).rejects.toThrow(error);

      expect(deploymentCloseJobService.reconcileExpired).toHaveBeenCalledWith(options);
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

  describe("notifyExpiringDeployments", () => {
    it("should call the service to notify expiring deployments", async () => {
      const { controller, expiringDeploymentsNotifierService } = setup();
      const options = { dryRun: false };

      await controller.notifyExpiringDeployments(options);

      expect(expiringDeploymentsNotifierService.notifyExpiringDeployments).toHaveBeenCalledWith(options);
    });
  });

  function setup() {
    const topUpManagedDeploymentsService = mock<TopUpManagedDeploymentsService>();
    const staleDeploymentsCleanerService = mock<StaleManagedDeploymentsCleanerService>();
    const deploymentCloseJobService = mock<DeploymentCloseJobService>();
    const expiringDeploymentsNotifierService = mock<ExpiringDeploymentsNotifierService>();
    const controller = new TopUpDeploymentsController(
      topUpManagedDeploymentsService,
      staleDeploymentsCleanerService,
      deploymentCloseJobService,
      expiringDeploymentsNotifierService
    );

    return {
      controller,
      topUpManagedDeploymentsService,
      staleDeploymentsCleanerService,
      deploymentCloseJobService,
      expiringDeploymentsNotifierService
    };
  }
});
