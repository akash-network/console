import { faker } from "@faker-js/faker";
import type { Counter } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { MetricsService } from "@src/core/services/metrics/metrics.service";
import type { DeploymentClosureState, DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import type { DeploymentSettingRepository, OpenDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { ClosedDeploymentsReconcilerService } from "./closed-deployments-reconciler.service";

import { createAkashAddress } from "@test/seeders";

describe(ClosedDeploymentsReconcilerService.name, () => {
  it("marks a record closed when the chain has already closed its deployment", async () => {
    const closed = openDeployment();
    const { service, deploymentSettingRepository } = setup({ openDeployments: [closed], closureStates: [closureState(closed, true)] });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([closed.id]);
  });

  it("marks a record closed whatever its owner chose about funding, since the query never reads that flag", async () => {
    const closed = openDeployment();
    const { service, deploymentSettingRepository } = setup({ openDeployments: [closed], closureStates: [closureState(closed, true)] });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.findOpenDeploymentsIteratively).toHaveBeenCalledWith({ batchSize: expect.any(Number) });
    expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([closed.id]);
  });

  it("leaves a record open while the chain still holds its deployment open", async () => {
    const running = openDeployment();
    const { service, deploymentSettingRepository, countersByName } = setup({
      openDeployments: [running],
      closureStates: [closureState(running, false)]
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).not.toHaveBeenCalled();
    expect(countersByName["closed_deployments_reconcile_rows_confirmed_open_total"].add).toHaveBeenCalledWith(1);
  });

  it("leaves a record alone when the indexer holds no deployment for it, rather than guessing it closed", async () => {
    const unknown = openDeployment();
    const { service, deploymentSettingRepository, countersByName } = setup({ openDeployments: [unknown], closureStates: [] });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).not.toHaveBeenCalled();
    expect(countersByName["closed_deployments_reconcile_rows_without_chain_state_total"].add).toHaveBeenCalledWith(1);
  });

  it("asks the chain about a dseq without the leading zeros only a stored record can carry", async () => {
    const padded = openDeployment({ dseq: "0000123" });
    const { service, deploymentRepository } = setup({ openDeployments: [padded] });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentRepository.findClosureStates).toHaveBeenCalledWith([{ owner: padded.address, dseq: "123" }]);
  });

  it("matches a dseq the two sources spell differently, so leading zeros do not read as an unknown deployment", async () => {
    const padded = openDeployment({ dseq: "0000123" });
    const { service, deploymentSettingRepository } = setup({
      openDeployments: [padded],
      closureStates: [{ owner: padded.address, dseq: "123", isClosed: true }]
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([padded.id]);
  });

  it("tells two dseqs apart beyond the precision of a float, so neither answers for the other", async () => {
    const owner = createAkashAddress();
    const running = openDeployment({ dseq: "62509094548213308557", address: owner });
    const closed = openDeployment({ dseq: "62509094548213308558", address: owner });
    const { service, deploymentSettingRepository } = setup({
      openDeployments: [running, closed],
      closureStates: [closureState(running, false), closureState(closed, true)]
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([closed.id]);
  });

  it("closes only the records the chain closed out of a mixed batch", async () => {
    const closed = openDeployment();
    const running = openDeployment();
    const unknown = openDeployment();
    const { service, deploymentSettingRepository } = setup({
      openDeployments: [closed, running, unknown],
      closureStates: [closureState(closed, true), closureState(running, false)]
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([closed.id]);
  });

  it("writes nothing and records no metrics during a dry run", async () => {
    const closed = openDeployment();
    const { service, deploymentSettingRepository, countersByName } = setup({
      openDeployments: [closed],
      closureStates: [closureState(closed, true)]
    });

    await service.reconcileClosedDeployments({ dryRun: true });

    expect(deploymentSettingRepository.markAsClosed).not.toHaveBeenCalled();
    expect(countersByName["closed_deployments_reconcile_rows_closed_total"].add).not.toHaveBeenCalled();
  });

  it("reports what a dry run would have closed", async () => {
    const closed = openDeployment();
    const { service, logger } = setup({ openDeployments: [closed], closureStates: [closureState(closed, true)] });

    await service.reconcileClosedDeployments({ dryRun: true });

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_END", scanned: 1, closed: 1, dryRun: true }));
  });

  it("keeps reconciling the remaining batches when one of them fails", async () => {
    const first = openDeployment();
    const second = openDeployment();
    const { service, deploymentSettingRepository, logger } = setup({
      batches: [[first], [second]],
      closureStates: [closureState(first, true), closureState(second, true)],
      markAsClosed: vi.fn().mockRejectedValueOnce(new Error("write conflict")).mockResolvedValue(undefined)
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_BATCH_FAILED" }));
    expect(deploymentSettingRepository.markAsClosed).toHaveBeenLastCalledWith([second.id]);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_END", failedBatches: 1, closed: 1 }));
  });

  it("credits a failed batch with nothing it did not write", async () => {
    const failing = openDeployment();
    const { service, countersByName } = setup({
      openDeployments: [failing],
      closureStates: [closureState(failing, true)],
      markAsClosed: vi.fn().mockRejectedValue(new Error("write conflict"))
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(countersByName["closed_deployments_reconcile_rows_closed_total"].add).not.toHaveBeenCalled();
  });

  it("stops scanning once enough batches fail in a row to mean the chain database is down rather than flaky", async () => {
    const batches = Array.from({ length: 6 }, () => [openDeployment()]);
    const { service, deploymentRepository, logger } = setup({
      batches,
      findClosureStates: vi.fn().mockRejectedValue(new Error("chain database unavailable"))
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentRepository.findClosureStates).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_ABANDONED", failedBatches: 3 }));
  });

  it("keeps scanning when failing batches are spaced out by batches that succeed", async () => {
    const batches = Array.from({ length: 5 }, () => [openDeployment()]);
    const { service, deploymentRepository, logger } = setup({
      batches,
      findClosureStates: vi
        .fn()
        .mockRejectedValueOnce(new Error("connection reset"))
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error("connection reset"))
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error("connection reset"))
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentRepository.findClosureStates).toHaveBeenCalledTimes(5);
    expect(logger.error).not.toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_ABANDONED" }));
  });

  it("reports a failure to read the records rather than raising it, so the funding sweep keeps its run", async () => {
    const { service, logger } = setup({ readError: new Error("database unavailable") });

    await expect(service.reconcileClosedDeployments({ dryRun: false })).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_FAILED" }));
    expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_END" }));
  });

  it("reads nothing from the chain when no record is open", async () => {
    const { service, deploymentRepository, logger } = setup({ openDeployments: [] });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentRepository.findClosureStates).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_END", scanned: 0 }));
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: ClosedDeploymentsReconcilerService.name });
  });

  function openDeployment(overrides: Partial<OpenDeployment> = {}): OpenDeployment {
    return {
      id: faker.string.uuid(),
      dseq: faker.number.int({ min: 1000, max: 9_999_999 }).toString(),
      address: createAkashAddress(),
      ...overrides
    };
  }

  function closureState(deployment: OpenDeployment, isClosed: boolean): DeploymentClosureState {
    return { owner: deployment.address, dseq: deployment.dseq, isClosed };
  }

  function setup(input?: {
    openDeployments?: OpenDeployment[];
    batches?: OpenDeployment[][];
    closureStates?: DeploymentClosureState[];
    findClosureStates?: DeploymentRepository["findClosureStates"];
    markAsClosed?: DeploymentSettingRepository["markAsClosed"];
    readError?: Error;
  }) {
    const batches = input?.batches ?? [input?.openDeployments ?? []];

    const deploymentSettingRepository = mock<DeploymentSettingRepository>({
      findOpenDeploymentsIteratively: vi.fn(async function* () {
        if (input?.readError) throw input.readError;

        for (const batch of batches) {
          if (batch.length) yield batch;
        }
      }),
      markAsClosed: input?.markAsClosed ?? vi.fn()
    });

    const deploymentRepository = mock<DeploymentRepository>({
      findClosureStates: input?.findClosureStates ?? vi.fn().mockResolvedValue(input?.closureStates ?? [])
    });

    const countersByName: Record<string, Counter> = {};
    const metricsService = mock<MetricsService>();
    metricsService.getMeter.mockReturnValue(mock());
    metricsService.createCounter.mockImplementation((_meter, name) => {
      const counter = mock<Counter>();
      countersByName[name] = counter;
      return counter;
    });

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new ClosedDeploymentsReconcilerService(deploymentSettingRepository, deploymentRepository, metricsService, createLogger);

    return { service, deploymentSettingRepository, deploymentRepository, metricsService, countersByName, logger, createLogger };
  }
});
