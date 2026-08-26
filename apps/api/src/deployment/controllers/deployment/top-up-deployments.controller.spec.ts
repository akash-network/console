import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

import type { ExpiredDeploymentsCloserService } from "@src/deployment/services/expired-deployments-closer/expired-deployments-closer.service";
import type { ExpiringDeploymentsNotifierService } from "@src/deployment/services/expiring-deployments-notifier/expiring-deployments-notifier.service";
import type { OrphanedDeploymentSettingsCleanerService } from "@src/deployment/services/orphaned-deployment-settings-cleaner/orphaned-deployment-settings-cleaner.service";
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

  describe("notifyExpiringDeployments", () => {
    it("should call the service to notify expiring deployments", async () => {
      const { controller, expiringDeploymentsNotifierService } = setup();
      const options = { dryRun: false };

      await controller.notifyExpiringDeployments(options);

      expect(expiringDeploymentsNotifierService.notifyExpiringDeployments).toHaveBeenCalledWith(options);
    });
  });

  describe("cleanupOrphanedDeploymentSettings", () => {
    it("calls the service to clean up orphaned deployment settings", async () => {
      const { controller, orphanedDeploymentSettingsCleanerService } = setup();
      const options = { dryRun: false };

      await controller.cleanupOrphanedDeploymentSettings(options);

      expect(orphanedDeploymentSettingsCleanerService.cleanup).toHaveBeenCalledWith(options);
    });
  });

  function setup(): {
    controller: TopUpDeploymentsController;
    topUpManagedDeploymentsService: MockProxy<TopUpManagedDeploymentsService>;
    staleDeploymentsCleanerService: MockProxy<StaleManagedDeploymentsCleanerService>;
    expiredDeploymentsCloserService: MockProxy<ExpiredDeploymentsCloserService>;
    expiringDeploymentsNotifierService: MockProxy<ExpiringDeploymentsNotifierService>;
    orphanedDeploymentSettingsCleanerService: MockProxy<OrphanedDeploymentSettingsCleanerService>;
  } {
    const topUpManagedDeploymentsService = mock<TopUpManagedDeploymentsService>();
    const staleDeploymentsCleanerService = mock<StaleManagedDeploymentsCleanerService>();
    const expiredDeploymentsCloserService = mock<ExpiredDeploymentsCloserService>();
    const expiringDeploymentsNotifierService = mock<ExpiringDeploymentsNotifierService>();
    const orphanedDeploymentSettingsCleanerService = mock<OrphanedDeploymentSettingsCleanerService>();
    const controller = new TopUpDeploymentsController(
      topUpManagedDeploymentsService,
      staleDeploymentsCleanerService,
      expiredDeploymentsCloserService,
      expiringDeploymentsNotifierService,
      orphanedDeploymentSettingsCleanerService
    );

    return {
      controller,
      topUpManagedDeploymentsService,
      staleDeploymentsCleanerService,
      expiredDeploymentsCloserService,
      expiringDeploymentsNotifierService,
      orphanedDeploymentSettingsCleanerService
    };
  }
});
