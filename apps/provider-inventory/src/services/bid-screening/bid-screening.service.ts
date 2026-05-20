import type { LoggerService } from "@akashnetwork/logging";
import { inject, singleton } from "tsyringe";

import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import { type BidScreeningCandidate, BidScreeningRepository } from "@src/repositories/bid-screening/bid-screening.repository";
import type { GroupSpecJSON } from "../../lib/groupspec-mapper/groupspec-mapper";
import { mapGroupSpecToResourceUnits } from "../../lib/groupspec-mapper/groupspec-mapper";
import type { BidScreeningResult } from "../../types/inventory.types";
import { ClusterInventoryMatcherService } from "../cluster-inventory-matcher/cluster-inventory-matcher.service";

@singleton()
export class BidScreeningService {
  readonly #repository: BidScreeningRepository;
  readonly #matcher: ClusterInventoryMatcherService;
  readonly #logger: LoggerService;

  constructor(repository: BidScreeningRepository, matcher: ClusterInventoryMatcherService, @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory) {
    this.#repository = repository;
    this.#matcher = matcher;
    this.#logger = loggerFactory({ context: "BidScreening" });
  }

  async findMatchingProviders(request: GroupSpecJSON): Promise<BidScreeningResult[]> {
    const startTime = Date.now();
    const resourceUnits = mapGroupSpecToResourceUnits(request);

    this.#logger.info({ event: "BID_SCREENING_START", resourceGroupCount: resourceUnits.length });

    const candidates = await this.#repository.findCandidates(resourceUnits, request.requirements);
    this.#logger.info({ event: "BID_SCREENING_CANDIDATES_FETCHED", count: candidates.length });

    const results: BidScreeningResult[] = [];

    for (const candidate of candidates) {
      const matchResult = this.#matcher.match(candidate.cluster, resourceUnits);

      if (matchResult.matched) {
        results.push(this.#toResult(candidate));
      }
    }

    this.#logger.info({
      event: "BID_SCREENING_COMPLETE",
      providerCount: candidates.length,
      matchedCount: results.length,
      durationMs: Date.now() - startTime
    });

    return results;
  }

  #toResult(candidate: BidScreeningCandidate): BidScreeningResult {
    return {
      owner: candidate.owner,
      hostUri: candidate.hostUri,
      isAudited: candidate.isAudited
    };
  }
}
