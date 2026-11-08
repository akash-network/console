import type { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import type { Counter } from "@opentelemetry/api";
import { subMinutes } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, JobQueueService } from "@src/core";
import type { MetricsService } from "@src/core/services/metrics/metrics.service";
import type { DeploymentClosureState, DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import type { DeploymentSettingRepository, OpenDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import {
  DeleteUnbackedDeploymentSetting,
  unbackedDeploymentSettingKeyFor
} from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { ClosedDeploymentsReconcilerService } from "./closed-deployments-reconciler.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders";
import { createDeploymentInfoErrorSeed, createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";

const GRACE_IN_MIN = 60;
const RETRY_LIMIT = 47;
const RETRY_DELAY_IN_SEC = 30;
const RETRY_DELAY_MAX_IN_MIN = 30;

describe(ClosedDeploymentsReconcilerService.name, () => {
  it("marks a record closed when the chain has already closed its deployment", async () => {
    const closed = openDeployment();
    const { service, deploymentSettingRepository } = setup({ openDeployments: [closed], closureStates: [closureState(closed, true)] });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([closed.id]);
  });

  it("asks the chain itself about a record the indexer reports closed before marking it", async () => {
    const closed = openDeployment();
    const { service, deploymentHttpService } = setup({ openDeployments: [closed], closureStates: [closureState(closed, true)] });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentHttpService.findByOwnerAndDseq).toHaveBeenCalledWith(closed.address, closed.dseq);
  });

  it("leaves a record open while the chain still returns its deployment active, whatever the indexer holds", async () => {
    const running = openDeployment();
    const { service, deploymentSettingRepository, logger, countersByName } = setup({
      openDeployments: [running],
      closureStates: [closureState(running, true)],
      findByOwnerAndDseq: vi.fn(async (owner: string, dseq: string) => createDeploymentInfoSeed({ owner, dseq, state: "active" }))
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({
      event: "CLOSED_DEPLOYMENTS_RECONCILE_CLOSE_UNCONFIRMED",
      deploymentSettingId: running.id,
      owner: running.address,
      dseq: running.dseq,
      chainAnswer: "active"
    });
    expect(countersByName["closed_deployments_reconcile_rows_close_unconfirmed_total"].add).toHaveBeenCalledWith(1);
    expect(countersByName["closed_deployments_reconcile_rows_closed_total"].add).toHaveBeenCalledWith(0);
  });

  it("leaves a record open when the chain does not return its deployment at all", async () => {
    const missing = openDeployment();
    const { service, deploymentSettingRepository, logger } = setup({
      openDeployments: [missing],
      closureStates: [closureState(missing, true)],
      findByOwnerAndDseq: vi.fn().mockResolvedValue(createDeploymentInfoErrorSeed({ message: "Deployment not found" }))
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_CLOSE_UNCONFIRMED", chainAnswer: "Deployment not found" })
    );
  });

  it("leaves a record whose chain read fails for the next run and still closes the rest of its batch", async () => {
    const unreadable = openDeployment();
    const closed = openDeployment();
    const { service, deploymentSettingRepository, logger } = setup({
      openDeployments: [unreadable, closed],
      closureStates: [closureState(unreadable, true), closureState(closed, true)],
      findByOwnerAndDseq: vi
        .fn()
        .mockRejectedValueOnce(new Error("node unreachable"))
        .mockImplementation(async (owner: string, dseq: string) => createDeploymentInfoSeed({ owner, dseq, state: "closed" }))
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([closed.id]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_CHAIN_READ_FAILED", deploymentSettingId: unreadable.id, error: expect.any(Error) })
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_END", closed: 1, closeUnconfirmed: 1, failedBatches: 0 })
    );
  });

  it("reads the chain only for the records the indexer reports closed", async () => {
    const closed = openDeployment();
    const running = openDeployment();
    const unbacked = openDeployment({ createdAt: subMinutes(new Date(), GRACE_IN_MIN + 1) });
    const { service, deploymentHttpService } = setup({
      openDeployments: [closed, running, unbacked],
      closureStates: [closureState(closed, true), closureState(running, false)]
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentHttpService.findByOwnerAndDseq).toHaveBeenCalledTimes(1);
    expect(deploymentHttpService.findByOwnerAndDseq).toHaveBeenCalledWith(closed.address, closed.dseq);
  });

  it("keeps at most ten chain reads in flight at once", async () => {
    const closed = Array.from({ length: 25 }, () => openDeployment());
    let readsInFlight = 0;
    let mostReadsInFlight = 0;
    const { service, deploymentSettingRepository } = setup({
      openDeployments: closed,
      closureStates: closed.map(deployment => closureState(deployment, true)),
      findByOwnerAndDseq: vi.fn(async (owner: string, dseq: string) => {
        readsInFlight++;
        mostReadsInFlight = Math.max(mostReadsInFlight, readsInFlight);
        await new Promise(resolve => setImmediate(resolve));
        readsInFlight--;
        return createDeploymentInfoSeed({ owner, dseq, state: "closed" });
      })
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(mostReadsInFlight).toBe(10);
    expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith(closed.map(({ id }) => id));
  });

  it("reports a close the chain did not confirm during a dry run without recording it", async () => {
    const running = openDeployment();
    const { service, logger, countersByName } = setup({
      openDeployments: [running],
      closureStates: [closureState(running, true)],
      findByOwnerAndDseq: vi.fn(async (owner: string, dseq: string) => createDeploymentInfoSeed({ owner, dseq, state: "active" }))
    });

    await service.reconcileClosedDeployments({ dryRun: true });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_END", closed: 0, closeUnconfirmed: 1, dryRun: true })
    );
    expect(countersByName["closed_deployments_reconcile_rows_close_unconfirmed_total"].add).not.toHaveBeenCalled();
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

  it("leaves a record the indexer has not seen yet alone while it is younger than the grace a create is given", async () => {
    const fresh = openDeployment({ createdAt: subMinutes(new Date(), GRACE_IN_MIN - 1) });
    const { service, deploymentSettingRepository, jobQueueService, countersByName } = setup({ openDeployments: [fresh], closureStates: [] });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(countersByName["closed_deployments_reconcile_rows_without_chain_state_total"].add).toHaveBeenCalledWith(1);
  });

  it("hands a record the indexer never saw to the compensation once it has outlived the grace, rather than deleting it itself", async () => {
    const unbacked = openDeployment({ createdAt: subMinutes(new Date(), GRACE_IN_MIN + 1) });
    const { service, deploymentSettingRepository, jobQueueService, countersByName } = setup({ openDeployments: [unbacked], closureStates: [] });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).not.toHaveBeenCalled();
    expect(deploymentSettingRepository.deleteById).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      new DeleteUnbackedDeploymentSetting({ deploymentSettingId: unbacked.id, owner: unbacked.address, dseq: unbacked.dseq }),
      expect.objectContaining({ singletonKey: unbackedDeploymentSettingKeyFor({ userId: unbacked.userId, dseq: unbacked.dseq }) })
    );
    expect(countersByName["closed_deployments_reconcile_rows_compensated_total"].add).toHaveBeenCalledWith(1);
    expect(countersByName["closed_deployments_reconcile_rows_without_chain_state_total"].add).toHaveBeenCalledWith(0);
  });

  it("gives a backlog compensation the retry horizon of one enqueued at create, below the priority of those", async () => {
    const unbacked = openDeployment({ createdAt: subMinutes(new Date(), GRACE_IN_MIN + 1) });
    const { service, jobQueueService } = setup({ openDeployments: [unbacked], closureStates: [] });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.anything(), {
      singletonKey: expect.any(String),
      priority: -1,
      retryLimit: RETRY_LIMIT,
      retryBackoff: true,
      retryDelay: RETRY_DELAY_IN_SEC,
      retryDelayMax: RETRY_DELAY_MAX_IN_MIN * 60
    });
  });

  it("hands the compensation the dseq as stored, since the handler refuses a payload that does not match the row", async () => {
    const padded = openDeployment({ dseq: "0000123", createdAt: subMinutes(new Date(), GRACE_IN_MIN + 1) });
    const { service, jobQueueService } = setup({ openDeployments: [padded], closureStates: [] });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dseq: "0000123" }) }), expect.anything());
  });

  it("skips a record whose compensation is already waiting, so hourly runs cannot stack jobs for one row", async () => {
    const unbacked = openDeployment({ createdAt: subMinutes(new Date(), GRACE_IN_MIN + 1) });
    const { service, jobQueueService, logger } = setup({
      openDeployments: [unbacked],
      closureStates: [],
      pendingCompensationKeys: [unbackedDeploymentSettingKeyFor({ userId: unbacked.userId, dseq: unbacked.dseq })]
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_END", compensated: 0 }));
  });

  it("counts nothing for a compensation the queue refused as a duplicate", async () => {
    const unbacked = openDeployment({ createdAt: subMinutes(new Date(), GRACE_IN_MIN + 1) });
    const { service, logger } = setup({ openDeployments: [unbacked], closureStates: [], enqueue: vi.fn().mockResolvedValue(null) });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_END", compensated: 0 }));
  });

  it("asks the chain about a dseq without the leading zeros only a stored record can carry", async () => {
    const padded = openDeployment({ dseq: "0000123" });
    const { service, deploymentRepository } = setup({ openDeployments: [padded] });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentRepository.findClosureStates).toHaveBeenCalledWith([{ owner: padded.address, dseq: "123" }]);
  });

  it("confirms a close with the chain under the dseq without the leading zeros a stored record can carry", async () => {
    const padded = openDeployment({ dseq: "0000123" });
    const { service, deploymentHttpService } = setup({
      openDeployments: [padded],
      closureStates: [{ owner: padded.address, dseq: "123", isClosed: true }]
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentHttpService.findByOwnerAndDseq).toHaveBeenCalledWith(padded.address, "123");
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

  it("closes only the records the chain closed out of a mixed batch, and compensates only the ones it never saw", async () => {
    const closed = openDeployment();
    const running = openDeployment();
    const unbacked = openDeployment({ createdAt: subMinutes(new Date(), GRACE_IN_MIN + 1) });
    const { service, deploymentSettingRepository, jobQueueService } = setup({
      openDeployments: [closed, running, unbacked],
      closureStates: [closureState(closed, true), closureState(running, false)]
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([closed.id]);
    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deploymentSettingId: unbacked.id }) }),
      expect.anything()
    );
  });

  it("writes nothing, enqueues nothing and records no metrics during a dry run", async () => {
    const closed = openDeployment();
    const unbacked = openDeployment({ createdAt: subMinutes(new Date(), GRACE_IN_MIN + 1) });
    const { service, deploymentSettingRepository, jobQueueService, countersByName } = setup({
      openDeployments: [closed, unbacked],
      closureStates: [closureState(closed, true)]
    });

    await service.reconcileClosedDeployments({ dryRun: true });

    expect(deploymentSettingRepository.markAsClosed).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(countersByName["closed_deployments_reconcile_rows_closed_total"].add).not.toHaveBeenCalled();
    expect(countersByName["closed_deployments_reconcile_rows_compensated_total"].add).not.toHaveBeenCalled();
  });

  it("reports what a dry run would have closed and compensated", async () => {
    const closed = openDeployment();
    const unbacked = openDeployment({ createdAt: subMinutes(new Date(), GRACE_IN_MIN + 1) });
    const { service, logger } = setup({ openDeployments: [closed, unbacked], closureStates: [closureState(closed, true)] });

    await service.reconcileClosedDeployments({ dryRun: true });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_END", scanned: 2, closed: 1, compensated: 1, dryRun: true })
    );
  });

  it("leaves a row whose compensation is already waiting out of what a dry run reports", async () => {
    const waiting = openDeployment({ createdAt: subMinutes(new Date(), GRACE_IN_MIN + 1) });
    const { service, logger } = setup({
      openDeployments: [waiting],
      closureStates: [],
      pendingCompensationKeys: [unbackedDeploymentSettingKeyFor(waiting)]
    });

    await service.reconcileClosedDeployments({ dryRun: true });

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_END", compensated: 0, dryRun: true }));
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

  it("keeps the closes a batch already committed when the queue refuses a compensation beside them", async () => {
    const closed = openDeployment();
    const unbacked = openDeployment({ createdAt: subMinutes(new Date(), GRACE_IN_MIN + 1) });
    const { service, logger, countersByName } = setup({
      openDeployments: [closed, unbacked],
      closureStates: [closureState(closed, true)],
      enqueue: vi.fn().mockRejectedValue(new Error("queue down"))
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_COMPENSATION_ENQUEUE_FAILED" }));
    expect(countersByName["closed_deployments_reconcile_rows_closed_total"].add).toHaveBeenCalledWith(1);
    expect(countersByName["closed_deployments_reconcile_rows_compensated_total"].add).toHaveBeenCalledWith(0);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_END", failedBatches: 0, closed: 1 }));
  });

  it("gives up on the rest of a batch's compensations once the queue refuses one, rather than a line per row", async () => {
    const unbacked = Array.from({ length: 3 }, () => openDeployment({ createdAt: subMinutes(new Date(), GRACE_IN_MIN + 1) }));
    const { service, jobQueueService } = setup({
      openDeployments: unbacked,
      closureStates: [],
      enqueue: vi.fn().mockRejectedValue(new Error("queue down"))
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
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

  it("keeps closing records the chain closed when the waiting compensations cannot be read", async () => {
    const closed = openDeployment();
    const { service, deploymentSettingRepository, logger } = setup({
      openDeployments: [closed],
      closureStates: [closureState(closed, true)],
      findPendingSingletonKeys: vi.fn().mockRejectedValue(new Error("queue unavailable"))
    });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([closed.id]);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_PENDING_COMPENSATIONS_UNREADABLE" }));
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CLOSED_DEPLOYMENTS_RECONCILE_END", closed: 1 }));
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
      userId: faker.string.uuid(),
      dseq: faker.number.int({ min: 1000, max: 9_999_999 }).toString(),
      address: createAkashAddress(),
      createdAt: new Date(),
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
    pendingCompensationKeys?: string[];
    findClosureStates?: DeploymentRepository["findClosureStates"];
    findByOwnerAndDseq?: DeploymentHttpService["findByOwnerAndDseq"];
    markAsClosed?: DeploymentSettingRepository["markAsClosed"];
    enqueue?: JobQueueService["enqueue"];
    findPendingSingletonKeys?: JobQueueService["findPendingSingletonKeys"];
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

    const deploymentHttpService = mock<DeploymentHttpService>({
      findByOwnerAndDseq: input?.findByOwnerAndDseq ?? vi.fn(async (owner: string, dseq: string) => createDeploymentInfoSeed({ owner, dseq, state: "closed" }))
    });

    const jobQueueService = mock<JobQueueService>({
      enqueue: input?.enqueue ?? vi.fn().mockResolvedValue(faker.string.uuid()),
      findPendingSingletonKeys: input?.findPendingSingletonKeys ?? vi.fn().mockResolvedValue(new Set(input?.pendingCompensationKeys ?? []))
    });

    const deploymentConfig = mockConfigService<DeploymentConfigService>({
      UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN: GRACE_IN_MIN,
      UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT: RETRY_LIMIT,
      UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC: RETRY_DELAY_IN_SEC,
      UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN: RETRY_DELAY_MAX_IN_MIN
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

    const service = new ClosedDeploymentsReconcilerService(
      deploymentSettingRepository,
      deploymentRepository,
      deploymentHttpService,
      jobQueueService,
      deploymentConfig,
      metricsService,
      createLogger
    );

    return {
      service,
      deploymentSettingRepository,
      deploymentRepository,
      deploymentHttpService,
      jobQueueService,
      deploymentConfig,
      metricsService,
      countersByName,
      logger,
      createLogger
    };
  }
});
