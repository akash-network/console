import "@test/mocks/logger-service.mock";

import type { DeploymentHttpService, DeploymentInfo, DeploymentListResponse } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/core/providers/logging.provider";
import type { DeploymentSettingRepository, UnbackedDeploymentSetting } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { OrphanedDeploymentSettingsCleanerService } from "./orphaned-deployment-settings-cleaner.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(OrphanedDeploymentSettingsCleanerService.name, () => {
  it("deletes a definition the chain has never heard of", async () => {
    const owner = createAkashAddress();
    const { service, deploymentSettingRepository } = setup({
      candidates: [candidate({ id: "orphan-id", dseq: "1000", address: owner })],
      onChainByOwner: { [owner]: [] }
    });

    await service.cleanup({ dryRun: false });

    expect(deploymentSettingRepository.deleteById).toHaveBeenCalledWith(["orphan-id"]);
  });

  it("keeps a definition whose deployment is on chain", async () => {
    const owner = createAkashAddress();
    const { service, deploymentSettingRepository } = setup({
      candidates: [candidate({ id: "live-id", dseq: "2000", address: owner })],
      onChainByOwner: { [owner]: [{ dseq: "2000", state: "active" }] }
    });

    await service.cleanup({ dryRun: false });

    expect(deploymentSettingRepository.deleteById).not.toHaveBeenCalled();
  });

  it("keeps every definition of an owner whose chain lookup fails, and reports the run as failed", async () => {
    const owner = createAkashAddress();
    const lookupError = new Error("chain unreachable");
    const { service, deploymentSettingRepository, logger } = setup({
      candidates: [candidate({ id: "unknown-id", dseq: "3000", address: owner })],
      findAll: () => Promise.reject(lookupError)
    });

    const result = await service.cleanup({ dryRun: false });

    expect(deploymentSettingRepository.deleteById).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "ORPHANED_DEPLOYMENT_SETTINGS_CLEANUP_OWNER_SKIPPED", owner, error: lookupError })
    );
  });

  it("keeps cleaning up the owners it can reach when one owner's lookup fails", async () => {
    const failing = createAkashAddress();
    const reachable = createAkashAddress();
    const { service, deploymentSettingRepository } = setup({
      candidates: [candidate({ id: "unknown-id", dseq: "4000", address: failing }), candidate({ id: "orphan-id", dseq: "4001", address: reachable })],
      onChainByOwner: { [reachable]: [] },
      findAll: ({ owner }) => (owner === failing ? Promise.reject(new Error("chain unreachable")) : undefined)
    });

    await service.cleanup({ dryRun: false });

    expect(deploymentSettingRepository.deleteById).toHaveBeenCalledWith(["orphan-id"]);
  });

  it("asks the chain once per owner rather than once per definition", async () => {
    const first = createAkashAddress();
    const second = createAkashAddress();
    const { service, deploymentHttpService } = setup({
      candidates: [
        candidate({ id: "a", dseq: "5000", address: first }),
        candidate({ id: "b", dseq: "5001", address: first }),
        candidate({ id: "c", dseq: "5002", address: second })
      ],
      onChainByOwner: { [first]: [], [second]: [] }
    });

    await service.cleanup({ dryRun: false });

    expect(deploymentHttpService.findAll).toHaveBeenCalledTimes(2);
  });

  it("deletes nothing on a dry run and reports what it would have deleted", async () => {
    const owner = createAkashAddress();
    const { service, deploymentSettingRepository, logger } = setup({
      candidates: [candidate({ id: "orphan-id", dseq: "6000", address: owner })],
      onChainByOwner: { [owner]: [] }
    });

    await service.cleanup({ dryRun: true });

    expect(deploymentSettingRepository.deleteById).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "ORPHANED_DEPLOYMENT_SETTINGS_WOULD_DELETE", owner, dseqs: ["6000"] }));
  });

  it("keeps a definition whose deployment the chain reports as closed", async () => {
    const owner = createAkashAddress();
    const { service, deploymentSettingRepository } = setup({
      candidates: [candidate({ id: "closed-id", dseq: "2500", address: owner })],
      onChainByOwner: { [owner]: [{ dseq: "2500", state: "closed" }] }
    });

    await service.cleanup({ dryRun: false });

    expect(deploymentSettingRepository.deleteById).not.toHaveBeenCalled();
  });

  it("asks the chain for every state, since a listing narrowed to active would report closed deployments as gone", async () => {
    const owner = createAkashAddress();
    const { service, deploymentHttpService } = setup({
      candidates: [candidate({ id: "closed-id", dseq: "2600", address: owner })],
      onChainByOwner: { [owner]: [{ dseq: "2600", state: "closed" }] }
    });

    await service.cleanup({ dryRun: false });

    expect(deploymentHttpService.findAll).toHaveBeenCalledWith({ owner });
  });

  it("reports a failed delete as a delete failure rather than a chain failure", async () => {
    const owner = createAkashAddress();
    const deleteError = new Error("database unavailable");
    const { service, logger } = setup({
      candidates: [candidate({ id: "orphan-id", dseq: "2700", address: owner })],
      onChainByOwner: { [owner]: [] },
      deleteById: vi.fn().mockRejectedValue(deleteError) as unknown as DeploymentSettingRepository["deleteById"]
    });

    const result = await service.cleanup({ dryRun: false });

    expect(result.ok).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "ORPHANED_DEPLOYMENT_SETTINGS_CLEANUP_OWNER_SKIPPED", reason: "DELETE_FAILED" })
    );
  });

  it("keeps paging until the candidates run out, so an orphan past the first page is still deleted", async () => {
    const owner = createAkashAddress();
    const { service, deploymentSettingRepository } = setup({
      candidates: [
        candidate({ id: "page1-a", dseq: "8000", address: owner }),
        candidate({ id: "page1-b", dseq: "8001", address: owner }),
        candidate({ id: "page2-a", dseq: "8002", address: owner }),
        candidate({ id: "page2-b", dseq: "8003", address: owner }),
        candidate({ id: "page3-a", dseq: "8004", address: owner })
      ],
      onChainByOwner: { [owner]: [] },
      pageSize: 2
    });

    await service.cleanup({ dryRun: false });

    expect(deploymentSettingRepository.deleteById).toHaveBeenCalledTimes(3);
    expect(deploymentSettingRepository.deleteById.mock.calls.flat(2)).toEqual(["page1-a", "page1-b", "page2-a", "page2-b", "page3-a"]);
  });

  it("resumes each page from the last record of the one before it", async () => {
    const owner = createAkashAddress();
    const { service, deploymentSettingRepository } = setup({
      candidates: [candidate({ id: "first", dseq: "8100", address: owner }), candidate({ id: "second", dseq: "8101", address: owner })],
      onChainByOwner: { [owner]: [] },
      pageSize: 1
    });

    await service.cleanup({ dryRun: false });

    const cursors = deploymentSettingRepository.findUnbackedDeploymentSettings.mock.calls.map(([params]) => params.olderThan?.id);
    expect(cursors).toEqual([undefined, "first", "second"]);
  });

  it("stops paging and warns when the time budget is spent, naming where the next run resumes", async () => {
    const owner = createAkashAddress();
    const { service, deploymentSettingRepository, logger } = setup({
      candidates: [candidate({ id: "first", dseq: "8200", address: owner }), candidate({ id: "second", dseq: "8201", address: owner })],
      onChainByOwner: { [owner]: [] },
      pageSize: 1,
      budgetInMin: 0
    });

    await service.cleanup({ dryRun: false });

    expect(deploymentSettingRepository.deleteById).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ORPHANED_DEPLOYMENT_SETTINGS_CLEANUP_CAPPED", reason: "TIME_BUDGET_SPENT" }));
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "ORPHANED_DEPLOYMENT_SETTINGS_CLEANUP_END", complete: false }));
  });

  it("reports a run that reached the end of the candidates as complete, even with no budget left", async () => {
    const owner = createAkashAddress();
    const { service, logger } = setup({
      candidates: [candidate({ id: "first", dseq: "8300", address: owner })],
      onChainByOwner: { [owner]: [] },
      pageSize: 2,
      budgetInMin: 0
    });

    await service.cleanup({ dryRun: false });

    expect(logger.warn).not.toHaveBeenCalledWith(expect.objectContaining({ event: "ORPHANED_DEPLOYMENT_SETTINGS_CLEANUP_CAPPED" }));
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "ORPHANED_DEPLOYMENT_SETTINGS_CLEANUP_END", complete: true }));
  });

  it("asks the chain for nothing when no definition is old enough", async () => {
    const { service, deploymentHttpService, deploymentSettingRepository } = setup({ candidates: [] });

    const result = await service.cleanup({ dryRun: false });

    expect(deploymentHttpService.findAll).not.toHaveBeenCalled();
    expect(deploymentSettingRepository.deleteById).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  function candidate(overrides: Partial<UnbackedDeploymentSetting> = {}): UnbackedDeploymentSetting {
    return { id: "candidate-id", dseq: "1", address: createAkashAddress(), createdAtMarker: "2026-01-01T00:00:00.000000", ...overrides };
  }

  function setup(input: {
    candidates?: UnbackedDeploymentSetting[];
    onChainByOwner?: Record<string, Array<{ dseq: string; state: string }>>;
    findAll?: (params: { owner: string }) => Promise<DeploymentListResponse> | undefined;
    deleteById?: DeploymentSettingRepository["deleteById"];
    graceHours?: number;
    pageSize?: number;
    budgetInMin?: number;
  }) {
    /** Mirrors the chain: unfiltered lists every state, `state` narrows to it. A cleanup that filtered would miss closed deployments. */
    const listFor = (owner: string, state?: string): DeploymentListResponse => {
      const owned = input.onChainByOwner?.[owner] ?? [];
      const visible = state ? owned.filter(deployment => deployment.state === state) : owned;

      return {
        deployments: visible.map(({ dseq, state: deploymentState }) => mock<DeploymentInfo>({ deployment: { id: { owner, dseq }, state: deploymentState } })),
        pagination: { next_key: null, total: visible.length.toString() }
      };
    };

    const all = input.candidates ?? [];
    const deploymentSettingRepository = mock<DeploymentSettingRepository>({
      findUnbackedDeploymentSettings: vi.fn(async ({ pageSize, olderThan }) => {
        const from = olderThan ? all.findIndex(row => row.id === olderThan.id) + 1 : 0;
        return all.slice(from, from + pageSize);
      }) as DeploymentSettingRepository["findUnbackedDeploymentSettings"],
      deleteById: input.deleteById ?? vi.fn().mockResolvedValue(undefined)
    });
    const deploymentHttpService = mock<DeploymentHttpService>({
      findAll: vi.fn(async ({ owner, state }: { owner: string; state?: string }) => (await input.findAll?.({ owner })) ?? listFor(owner, state))
    });
    const config = mockConfigService<DeploymentConfigService>({
      ORPHANED_DEPLOYMENT_SETTINGS_CLEANUP_GRACE_IN_H: input.graceHours ?? 1,
      ORPHANED_DEPLOYMENT_SETTINGS_CLEANUP_PAGE_SIZE: input.pageSize ?? 500,
      ORPHANED_DEPLOYMENT_SETTINGS_CLEANUP_BUDGET_IN_MIN: input.budgetInMin ?? 20
    });
    const logger = mock<LoggerService>();

    const service = new OrphanedDeploymentSettingsCleanerService(deploymentSettingRepository, deploymentHttpService, config, logger);

    return { service, deploymentSettingRepository, deploymentHttpService, config, logger };
  }
});
