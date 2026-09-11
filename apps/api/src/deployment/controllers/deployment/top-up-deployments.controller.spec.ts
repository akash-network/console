import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ClosedDeploymentsReconcilerService } from "@src/deployment/services/closed-deployments-reconciler/closed-deployments-reconciler.service";
import type { DeploymentCloseJobService } from "@src/deployment/services/deployment-close-job/deployment-close-job.service";
import type { ExpiringDeploymentsNotifierService } from "@src/deployment/services/expiring-deployments-notifier/expiring-deployments-notifier.service";
import type { StaleManagedDeploymentsCleanerService } from "@src/deployment/services/stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";
import type { TopUpManagedDeploymentsService } from "@src/deployment/services/top-up-managed-deployments/top-up-managed-deployments.service";
import type { UnreachableProviderDeploymentsCloserService } from "@src/deployment/services/unreachable-provider-deployments-closer/unreachable-provider-deployments-closer.service";
import type { UnreachableProviderDeploymentsNotifierService } from "@src/deployment/services/unreachable-provider-deployments-notifier/unreachable-provider-deployments-notifier.service";
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

    it("reconciles deployment records against chain state, which the funding sweep's own selection cannot reach", async () => {
      const { controller, closedDeploymentsReconcilerService } = setup();
      const options = { concurrency: 5, dryRun: false };

      await controller.topUpDeployments(options);

      expect(closedDeploymentsReconcilerService.reconcileClosedDeployments).toHaveBeenCalledWith(options);
    });

    it("reconciles deployment records before the funding sweep so a sweep failure cannot skip them", async () => {
      const { controller, topUpManagedDeploymentsService, closedDeploymentsReconcilerService } = setup();
      topUpManagedDeploymentsService.topUpDeployments.mockRejectedValue(new Error("chain rpc unavailable"));
      const options = { concurrency: 5, dryRun: false };

      await expect(controller.topUpDeployments(options)).rejects.toThrow("chain rpc unavailable");

      expect(closedDeploymentsReconcilerService.reconcileClosedDeployments.mock.invocationCallOrder[0]).toBeLessThan(
        topUpManagedDeploymentsService.topUpDeployments.mock.invocationCallOrder[0]
      );
    });

    it("reconciles close jobs before the funding sweep so a sweep failure cannot skip them", async () => {
      const { controller, topUpManagedDeploymentsService, deploymentCloseJobService } = setup();
      const error = new Error("chain rpc unavailable");
      topUpManagedDeploymentsService.topUpDeployments.mockRejectedValue(error);
      const options = { concurrency: 5, dryRun: false };

      await expect(controller.topUpDeployments(options)).rejects.toThrow(error);

      expect(deploymentCloseJobService.reconcileExpired).toHaveBeenCalledWith(options);
      expect(deploymentCloseJobService.reconcileExpired.mock.invocationCallOrder[0]).toBeLessThan(
        topUpManagedDeploymentsService.topUpDeployments.mock.invocationCallOrder[0]
      );
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

  describe("notifyUnreachableProviderDeployments", () => {
    it("delegates to the service that warns owners of deployments on unreachable providers", async () => {
      const { controller, unreachableProviderDeploymentsNotifierService } = setup();
      const options = { dryRun: false };

      await controller.notifyUnreachableProviderDeployments(options);

      expect(unreachableProviderDeploymentsNotifierService.notifyUnreachableProviderDeployments).toHaveBeenCalledWith(options);
    });
  });

  describe("closeUnreachableProviderDeployments", () => {
    it("delegates to the service that closes deployments left on unreachable providers", async () => {
      const { controller, unreachableProviderDeploymentsCloserService } = setup();
      const options = { dryRun: false };

      await controller.closeUnreachableProviderDeployments(options);

      expect(unreachableProviderDeploymentsCloserService.closeUnreachableProviderDeployments).toHaveBeenCalledWith(options);
    });
  });

  function setup() {
    const topUpManagedDeploymentsService = mock<TopUpManagedDeploymentsService>();
    const staleDeploymentsCleanerService = mock<StaleManagedDeploymentsCleanerService>();
    const deploymentCloseJobService = mock<DeploymentCloseJobService>();
    const expiringDeploymentsNotifierService = mock<ExpiringDeploymentsNotifierService>();
    const unreachableProviderDeploymentsNotifierService = mock<UnreachableProviderDeploymentsNotifierService>();
    const unreachableProviderDeploymentsCloserService = mock<UnreachableProviderDeploymentsCloserService>();
    const closedDeploymentsReconcilerService = mock<ClosedDeploymentsReconcilerService>();
    const controller = new TopUpDeploymentsController(
      topUpManagedDeploymentsService,
      staleDeploymentsCleanerService,
      deploymentCloseJobService,
      expiringDeploymentsNotifierService,
      unreachableProviderDeploymentsNotifierService,
      unreachableProviderDeploymentsCloserService,
      closedDeploymentsReconcilerService
    );

    return {
      controller,
      topUpManagedDeploymentsService,
      staleDeploymentsCleanerService,
      deploymentCloseJobService,
      expiringDeploymentsNotifierService,
      unreachableProviderDeploymentsNotifierService,
      unreachableProviderDeploymentsCloserService,
      closedDeploymentsReconcilerService
    };
  }
});
