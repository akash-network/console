import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { minutesToMilliseconds } from "date-fns";
import groupBy from "lodash/groupBy";
import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";

import { LoggerService } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import {
  DeploymentSettingRepository,
  type UnbackedDefinitionCandidate,
  type UnbackedDefinitionCursor
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";

/**
 * Deletes the definition the console remembered for a deployment that was never created, which is the one
 * kind of record nothing else can reach: a definition is written just before the create tx is broadcast, so
 * a failed broadcast leaves a row on a dseq the chain has never heard of. The stale-deployment cleanup
 * starts from on-chain deployments, and the funding sweep skips any remembered dseq it finds no lease for,
 * so neither ever sees one. Left alone they only accumulate.
 *
 * Records for deployments that reached the chain are kept whatever state they are in, closed included: a
 * closed deployment is exactly the one its owner redeploys from, and the stripped SDL is the only copy the
 * console holds.
 *
 * Fails closed throughout. Deleting is irreversible and a definition cannot be rebuilt from anything else,
 * so every uncertainty resolves to keeping the row and trying again next run.
 */
@singleton()
export class OrphanedDefinitionsSweeperService {
  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly config: DeploymentConfigService,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(OrphanedDefinitionsSweeperService.name);
  }

  /**
   * Pages through every candidate rather than taking a fixed number of them. A record the sweep does not
   * examine is always among the oldest of its cohort, and the next run reads the newest first, so anything a
   * record cap left behind would sit under a waterline that only ever rises — unreachable for good, and
   * worst during the broadcast outage that produces orphans in bulk. Time bounds a run instead: the budget
   * stops the paging and the run reports how far it got.
   *
   * The clock is read between pages, not between owners, so the real bound is the budget plus one page —
   * long enough, against a throttling node, to run past the job's `activeDeadlineSeconds`. Being killed
   * there costs the closing log and nothing else: each owner's delete is its own committed statement, so a
   * run that ends mid-page leaves the same state as one that ends between pages, and the next run resumes
   * from the newest record either way.
   *
   * A short page means the set is exhausted, so that is checked before the clock — finishing the last page
   * on the last of the budget is a complete run. A final page that is exactly full when the budget expires
   * still reports itself truncated, since confirming otherwise would take another read; the next run finds
   * nothing left, so the overstatement corrects itself.
   */
  async sweep({ dryRun }: DryRunOptions): Promise<Result<void, unknown[]>> {
    const graceHours = this.config.get("ORPHANED_DEFINITION_SWEEP_GRACE_IN_H");
    const pageSize = this.config.get("ORPHANED_DEFINITION_SWEEP_PAGE_SIZE");
    const budgetMs = minutesToMilliseconds(this.config.get("ORPHANED_DEFINITION_SWEEP_BUDGET_IN_MIN"));
    const startedAt = Date.now();

    this.logger.info({ event: "ORPHANED_DEFINITION_SWEEP_START", graceHours, pageSize, budgetMs, dryRun });

    const errors: unknown[] = [];
    let olderThan: UnbackedDefinitionCursor | undefined;
    let candidateCount = 0;
    let pageCount = 0;
    let orphanCount = 0;
    let deletedCount = 0;
    let outOfTime = false;

    while (true) {
      const page = await this.deploymentSettingRepository.findUnbackedDefinitionCandidates({ graceHours, pageSize, olderThan });

      if (!page.length) {
        break;
      }

      pageCount++;
      candidateCount += page.length;
      const pageResult = await this.#sweepPage(page, dryRun, errors);
      orphanCount += pageResult.orphans;
      deletedCount += pageResult.deleted;
      olderThan = page[page.length - 1];

      if (page.length < pageSize) {
        break;
      }

      if (Date.now() - startedAt >= budgetMs) {
        outOfTime = true;
        break;
      }
    }

    if (outOfTime) {
      this.logger.warn({
        event: "ORPHANED_DEFINITION_SWEEP_CAPPED",
        reason: "TIME_BUDGET_SPENT",
        message: "Stopped before the oldest candidates; the next run starts again from the newest",
        examined: candidateCount,
        resumesOlderThan: olderThan?.createdAtMarker,
        budgetMs
      });
    }

    this.logger.info({
      event: "ORPHANED_DEFINITION_SWEEP_END",
      pages: pageCount,
      examined: candidateCount,
      orphans: orphanCount,
      deleted: deletedCount,
      skippedOwners: errors.length,
      complete: !outOfTime,
      dryRun
    });

    return errors.length > 0 ? Err(errors) : Ok(undefined);
  }

  async #sweepPage(page: UnbackedDefinitionCandidate[], dryRun: boolean, errors: unknown[]): Promise<{ orphans: number; deleted: number }> {
    let orphans = 0;
    let deleted = 0;

    for (const [address, owned] of Object.entries(groupBy(page, candidate => candidate.address))) {
      let unbacked: UnbackedDefinitionCandidate[];

      try {
        unbacked = await this.#findUnbacked(address, owned);
      } catch (error) {
        this.logger.error({ event: "ORPHANED_DEFINITION_SWEEP_OWNER_SKIPPED", reason: "CHAIN_LOOKUP_FAILED", owner: address, error });
        errors.push(error);
        continue;
      }

      if (!unbacked.length) {
        continue;
      }

      orphans += unbacked.length;
      const dseqs = unbacked.map(orphan => orphan.dseq);

      if (dryRun) {
        this.logger.info({ event: "ORPHANED_DEFINITION_WOULD_SWEEP", owner: address, dseqs });
        continue;
      }

      try {
        await this.#delete(unbacked);
        this.logger.info({ event: "ORPHANED_DEFINITION_SWEPT", owner: address, dseqs });
        deleted += unbacked.length;
      } catch (error) {
        this.logger.error({ event: "ORPHANED_DEFINITION_SWEEP_OWNER_SKIPPED", reason: "DELETE_FAILED", owner: address, dseqs, error });
        errors.push(error);
      }
    }

    return { orphans, deleted };
  }

  /**
   * One chain listing answers for every candidate an owner has, so the cost of a page is one request per
   * owner in it rather than one per record.
   *
   * The listing is deliberately unfiltered by state, and that is what keeps the record of a closed
   * deployment: `closed` on the settings row is only ever set by the funding sweep and the runtime-limit
   * closer, so a deployment its owner closed by hand still arrives here as a candidate, and only its coming
   * back in this response tells the sweep to leave it alone. Narrowing to `{ owner, state: "active" }` would
   * report every closed deployment as one that never existed and delete the only copy of its SDL.
   *
   * Throws rather than returning nothing when the lookup fails, because an empty answer already means
   * something else: an owner with nothing on chain, every one of whose candidates is an orphan.
   */
  async #findUnbacked(address: string, candidates: UnbackedDefinitionCandidate[]): Promise<UnbackedDefinitionCandidate[]> {
    const { deployments } = await this.deploymentHttpService.findAll({ owner: address });
    const onChainDseqs = new Set(deployments.map(({ deployment }) => deployment.id.dseq));

    return candidates.filter(candidate => !onChainDseqs.has(candidate.dseq));
  }

  /**
   * Neither this delete nor the candidate read above it is routed through `accessibleBy`, and neither may
   * be. This runs from the CLI, whose principal carries an empty ability, and `DrizzleAbility` calls
   * `throwUnlessCan` in a field initializer — so a scoped repository would throw `ForbiddenError` before any
   * SQL ran, on every owner, and the sweep would never delete anything at all. The integration suite pins it
   * by running the real CLI entrypoint inside the context `console.ts` builds.
   */
  async #delete(orphans: UnbackedDefinitionCandidate[]): Promise<void> {
    await this.deploymentSettingRepository.deleteById(orphans.map(orphan => orphan.id));
  }
}
