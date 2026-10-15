import { createMongoAbility, type MongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core";
import type { DeploymentLeaseState, DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import type { DeploymentSettingRepository, UnclosedReachableDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { UNINDEXED_DEPLOYMENT_GRACE_MINUTES } from "@src/deployment/services/deployment-list/deployment-list.service";
import { MAX_SEARCHABLE_DEPLOYMENTS } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { ProjectDeploymentSummaryService } from "./project-deployment-summary.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(ProjectDeploymentSummaryService.name, () => {
  describe("summarizeByProject", () => {
    it("counts each project's active deployments and previews the newest three, newest first by dseq", async () => {
      const [web, api] = [faker.string.uuid(), faker.string.uuid()];
      const inWeb = ["9", "1000", "0100", "10", "1786772209416"].map(dseq => unclosed({ projectId: web, dseq }));
      const inApi = unclosed({ projectId: api, dseq: "42", name: "api" });
      const { service, organizationId } = setup({ unclosed: [...inWeb, inApi] });

      const summaries = await service.summarizeByProject(organizationId);

      expect(summaries).toEqual(
        new Map([
          [web, { activeCount: 5, preview: ["1786772209416", "1000", "0100"].map(dseq => ({ dseq, name: null, status: "pending" })) }],
          [api, { activeCount: 1, preview: [{ dseq: "42", name: "api", status: "pending" }] }]
        ])
      );
    });

    it("orders dseqs of the same length by their digits", async () => {
      const projectId = faker.string.uuid();
      const { service, organizationId } = setup({ unclosed: ["12", "31", "23"].map(dseq => unclosed({ projectId, dseq })) });

      const summaries = await service.summarizeByProject(organizationId);

      expect(summaries?.get(projectId)?.preview.map(({ dseq }) => dseq)).toEqual(["31", "23", "12"]);
    });

    it("counts a deployment the chain index holds open, or has not seen yet while it is recent", async () => {
      const projectId = faker.string.uuid();
      const indexedOpen = unclosed({ projectId, dseq: "4", isRecent: false });
      const recent = unclosed({ projectId, dseq: "3", isRecent: true });
      const closedOnChain = unclosed({ projectId, dseq: "2", isRecent: true });
      const unindexedAndOld = unclosed({ projectId, dseq: "1", isRecent: false });
      const { service, organizationId } = setup({
        unclosed: [indexedOpen, recent, closedOnChain, unindexedAndOld],
        indexed: [indexedOpen, closedOnChain],
        closedOnChain: [closedOnChain]
      });

      const summaries = await service.summarizeByProject(organizationId);

      expect(summaries?.get(projectId)).toMatchObject({ activeCount: 2, preview: [{ dseq: "4" }, { dseq: "3" }] });
    });

    it("tells running, degraded and pending deployments apart by their leases on the chain index", async () => {
      const projectId = faker.string.uuid();
      const running = unclosed({ projectId, dseq: "3" });
      const degraded = unclosed({ projectId, dseq: "2" });
      const pending = unclosed({ projectId, dseq: "1" });
      const { service, organizationId } = setup({
        unclosed: [running, degraded, pending],
        leaseStates: [leaseState(running, { hasLease: true, hasOpenLease: true }), leaseState(degraded, { hasLease: true }), leaseState(pending)]
      });

      const summaries = await service.summarizeByProject(organizationId);

      expect(summaries?.get(projectId)?.preview.map(({ status }) => status)).toEqual(["running", "degraded", "pending"]);
    });

    it("asks the chain index about the previewed deployments only, by their normalized dseq", async () => {
      const projectId = faker.string.uuid();
      const deployments = ["0004", "3", "2", "1"].map(dseq => unclosed({ projectId, dseq }));
      const { service, organizationId, deploymentRepository } = setup({ unclosed: deployments });

      await service.summarizeByProject(organizationId);

      expect(deploymentRepository.findLeaseStates).toHaveBeenCalledWith(
        deployments.slice(0, 3).map(({ owner, dseq }) => ({ owner, dseq: dseq.replace(/^0+/, "") }))
      );
    });

    it("reads the open deployments of the organization the caller may read, as many as the deployment list sorts through", async () => {
      const { service, organizationId, ability, deploymentSettingRepository, scopedSettingRepository } = setup();

      await service.summarizeByProject(organizationId);

      expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(scopedSettingRepository.findUnclosedReachable).toHaveBeenCalledWith(
        { organizationId },
        { limit: MAX_SEARCHABLE_DEPLOYMENTS + 1, recentMinutes: UNINDEXED_DEPLOYMENT_GRACE_MINUTES }
      );
    });

    it("leaves out a deployment filed in no project", async () => {
      const { service, organizationId, deploymentRepository } = setup({ unclosed: [unclosed({ projectId: null })] });

      const summaries = await service.summarizeByProject(organizationId);

      expect(summaries).toEqual(new Map());
      expect(deploymentRepository.findClosureStates).toHaveBeenCalledWith([]);
    });

    it("summarizes nothing without reading when the caller may read no deployment", async () => {
      const { service, organizationId, deploymentSettingRepository } = setup({ canReadDeployments: false });

      const summaries = await service.summarizeByProject(organizationId);

      expect(summaries).toEqual(new Map());
      expect(deploymentSettingRepository.accessibleBy).not.toHaveBeenCalled();
    });

    it("gives up and warns when more deployments are open than it checks against the chain index at once", async () => {
      const projectId = faker.string.uuid();
      const { service, organizationId, deploymentRepository, logger } = setup({
        unclosed: Array.from({ length: MAX_SEARCHABLE_DEPLOYMENTS + 1 }, (_, index) => unclosed({ projectId, dseq: String(index + 1) }))
      });

      const summaries = await service.summarizeByProject(organizationId);

      expect(summaries).toBeUndefined();
      expect(deploymentRepository.findClosureStates).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "PROJECT_DEPLOYMENT_SUMMARY_TOO_LARGE", organizationId });
    });

    it("summarizes exactly as many open deployments as it checks at once", async () => {
      const projectId = faker.string.uuid();
      const { service, organizationId } = setup({
        unclosed: Array.from({ length: MAX_SEARCHABLE_DEPLOYMENTS }, (_, index) => unclosed({ projectId, dseq: String(index + 1), isRecent: true }))
      });

      const summaries = await service.summarizeByProject(organizationId);

      expect(summaries?.get(projectId)?.activeCount).toBe(MAX_SEARCHABLE_DEPLOYMENTS);
    });
  });

  function unclosed(overrides: Partial<UnclosedReachableDeployment> = {}): UnclosedReachableDeployment {
    return {
      id: faker.string.uuid(),
      dseq: faker.string.numeric(8),
      owner: createAkashAddress(),
      projectId: faker.string.uuid(),
      name: null,
      isRecent: true,
      ...overrides
    };
  }

  function leaseState({ owner, dseq }: UnclosedReachableDeployment, state: Partial<DeploymentLeaseState> = {}): DeploymentLeaseState {
    return { owner, dseq, hasLease: false, hasOpenLease: false, ...state };
  }

  function setup(
    input: {
      canReadDeployments?: boolean;
      unclosed?: UnclosedReachableDeployment[];
      indexed?: UnclosedReachableDeployment[];
      closedOnChain?: UnclosedReachableDeployment[];
      leaseStates?: DeploymentLeaseState[];
    } = {}
  ) {
    const organizationId = faker.string.uuid();
    const ability = createMongoAbility<MongoAbility>(
      input.canReadDeployments === false ? [] : [{ action: "read", subject: "DeploymentSetting", conditions: { organizationId } }]
    );
    const authService = mock<AuthService>();
    authService.ability = ability;

    const scopedSettingRepository = mock<DeploymentSettingRepository>();
    scopedSettingRepository.findUnclosedReachable.mockResolvedValue(input.unclosed ?? []);
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.accessibleBy.mockReturnValue(scopedSettingRepository);

    const deploymentRepository = mock<DeploymentRepository>();
    deploymentRepository.findClosureStates.mockResolvedValue(
      (input.indexed ?? []).map(({ owner, dseq }) => ({ owner, dseq, isClosed: !!input.closedOnChain?.some(closed => closed.dseq === dseq) }))
    );
    deploymentRepository.findLeaseStates.mockResolvedValue(input.leaseStates ?? []);

    const logger = mock<ReturnType<CreateLogger>>();
    const service = new ProjectDeploymentSummaryService(
      deploymentSettingRepository,
      deploymentRepository,
      authService,
      vi.fn<CreateLogger>(() => logger)
    );

    return { service, organizationId, ability, deploymentSettingRepository, scopedSettingRepository, deploymentRepository, logger };
  }
});
