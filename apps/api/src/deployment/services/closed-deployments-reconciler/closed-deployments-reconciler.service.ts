import type { Counter } from "@opentelemetry/api";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { MetricsService } from "@src/core/services/metrics/metrics.service";
import type { DryRunOptions } from "@src/core/types/console";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { DeploymentSettingRepository, type OpenDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";

const BATCH_SIZE = 1000;
/** Bounds what an unreachable chain database can cost the funding sweep that shares this command's hour. */
const MAX_CONSECUTIVE_BATCH_FAILURES = 3;

type BatchOutcome = {
  closed: number;
  confirmedOpen: number;
  withoutChainState: number;
};

type ReconcileTally = BatchOutcome & {
  scanned: number;
  failedBatches: number;
};

/** Stripped as text rather than through `Number`, which a dseq above 2^53 would not survive intact. */
function normalizeDseq(dseq: string): string {
  return dseq.replace(/^0+(?=\d)/, "");
}

function closureKey({ owner, dseq }: { owner: string; dseq: string }): string {
  return `${owner}/${normalizeDseq(dseq)}`;
}

@singleton()
export class ClosedDeploymentsReconcilerService {
  readonly #logger: ReturnType<CreateLogger>;
  readonly #rowsClosed: Counter;
  readonly #rowsConfirmedOpen: Counter;
  readonly #rowsWithoutChainState: Counter;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentRepository: DeploymentRepository,
    metricsService: MetricsService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ClosedDeploymentsReconcilerService.name });

    const meter = metricsService.getMeter("closed-deployments-reconcile");
    this.#rowsClosed = metricsService.createCounter(meter, "closed_deployments_reconcile_rows_closed_total", {
      description: "Deployment records marked closed because the chain had already closed their deployment"
    });
    this.#rowsConfirmedOpen = metricsService.createCounter(meter, "closed_deployments_reconcile_rows_confirmed_open_total", {
      description: "Deployment records left open because the chain still holds their deployment open"
    });
    this.#rowsWithoutChainState = metricsService.createCounter(meter, "closed_deployments_reconcile_rows_without_chain_state_total", {
      description: "Deployment records left alone because the indexer holds no deployment for them"
    });
  }

  /** Only safe because the indexer lags in one direction: it can miss a close it has not caught up to, never invent one. */
  async reconcileClosedDeployments({ dryRun }: DryRunOptions): Promise<void> {
    const tally: ReconcileTally = { scanned: 0, closed: 0, confirmedOpen: 0, withoutChainState: 0, failedBatches: 0 };

    this.#logger.info({ event: "CLOSED_DEPLOYMENTS_RECONCILE_START", batchSize: BATCH_SIZE, dryRun });

    let consecutiveFailures = 0;

    try {
      for await (const batch of this.deploymentSettingRepository.findOpenDeploymentsIteratively({ batchSize: BATCH_SIZE })) {
        tally.scanned += batch.length;

        try {
          const outcome = await this.#reconcileBatch(batch, dryRun);

          tally.closed += outcome.closed;
          tally.confirmedOpen += outcome.confirmedOpen;
          tally.withoutChainState += outcome.withoutChainState;

          if (!dryRun) {
            this.#recordOutcome(outcome);
          }

          consecutiveFailures = 0;
        } catch (error) {
          tally.failedBatches++;
          consecutiveFailures++;
          this.#logger.error({ event: "CLOSED_DEPLOYMENTS_RECONCILE_BATCH_FAILED", batchSize: batch.length, error });

          if (consecutiveFailures >= MAX_CONSECUTIVE_BATCH_FAILURES) {
            this.#logger.error({ event: "CLOSED_DEPLOYMENTS_RECONCILE_ABANDONED", ...tally, consecutiveFailures });
            break;
          }
        }
      }
    } catch (error) {
      this.#logger.error({ event: "CLOSED_DEPLOYMENTS_RECONCILE_FAILED", ...tally, error });
      return;
    }

    this.#logger.info({ event: "CLOSED_DEPLOYMENTS_RECONCILE_END", ...tally, dryRun });
  }

  async #reconcileBatch(batch: OpenDeployment[], dryRun: boolean): Promise<BatchOutcome> {
    const closureStates = await this.deploymentRepository.findClosureStates(batch.map(({ address, dseq }) => ({ owner: address, dseq: normalizeDseq(dseq) })));
    const closedByKey = new Map(closureStates.map(state => [closureKey(state), state.isClosed]));

    const idsToClose: string[] = [];
    let confirmedOpen = 0;
    let withoutChainState = 0;

    for (const deployment of batch) {
      const isClosedOnChain = closedByKey.get(closureKey({ owner: deployment.address, dseq: deployment.dseq }));

      if (isClosedOnChain === true) {
        idsToClose.push(deployment.id);
      } else if (isClosedOnChain === false) {
        confirmedOpen++;
      } else {
        withoutChainState++;
      }
    }

    if (!dryRun && idsToClose.length) {
      await this.deploymentSettingRepository.markAsClosed(idsToClose);
    }

    return { closed: idsToClose.length, confirmedOpen, withoutChainState };
  }

  /** Credited per batch and only after its write landed, so a run that dies part way still reports what it converged. */
  #recordOutcome({ closed, confirmedOpen, withoutChainState }: BatchOutcome): void {
    this.#rowsClosed.add(closed);
    this.#rowsConfirmedOpen.add(confirmedOpen);
    this.#rowsWithoutChainState.add(withoutChainState);
  }
}
