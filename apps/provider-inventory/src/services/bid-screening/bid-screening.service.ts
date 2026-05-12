import { BadRequest } from "http-errors";
import { singleton } from "tsyringe";

import { type GroupSpecJSON, mapGroupSpecToResourceUnits } from "@src/lib/groupspec-mapper/groupspec-mapper";
import { aggregateResourceUnits } from "@src/lib/resource-aggregator/resource-aggregator";
import { LoggerService } from "@src/providers/logging.provider";
import type { BidScreeningCandidate, BidScreeningRequirements } from "@src/repositories/bid-screening/bid-screening.repository";
import { BidScreeningRepository } from "@src/repositories/bid-screening/bid-screening.repository";
import { ClusterInventoryMatcherService } from "@src/services/cluster-inventory-matcher/cluster-inventory-matcher.service";
import type { BidScreeningResult } from "@src/types/inventory.types";

@singleton()
export class BidScreeningService {
  readonly #repository: BidScreeningRepository;
  readonly #matcher: ClusterInventoryMatcherService;
  readonly #logger: LoggerService;

  constructor(repository: BidScreeningRepository, matcher: ClusterInventoryMatcherService, logger: LoggerService) {
    this.#repository = repository;
    this.#matcher = matcher;
    this.#logger = logger;
  }

  async findMatchingProviders(request: GroupSpecJSON): Promise<BidScreeningResult[]> {
    const startTime = Date.now();

    this.#validateRequest(request);

    const resourceUnits = mapGroupSpecToResourceUnits(request);
    const aggregates = aggregateResourceUnits(resourceUnits);
    const requirements: BidScreeningRequirements = {
      signedBy: request.requirements?.signedBy,
      attributes: request.requirements?.attributes
    };

    this.#logger.info({ event: "BID_SCREENING_START", resourceGroupCount: resourceUnits.length });

    const candidates = await this.#repository.findCandidates(aggregates, requirements);

    const results: BidScreeningResult[] = [];
    for (const candidate of candidates) {
      const matchResult = this.#matcher.match(candidate, resourceUnits);
      if (matchResult.matched) {
        results.push(this.#toResult(candidate));
      }
    }

    this.#logger.info({
      event: "BID_SCREENING_COMPLETE",
      candidateCount: candidates.length,
      matchedCount: results.length,
      durationMs: Date.now() - startTime
    });

    return results;
  }

  #validateRequest(request: GroupSpecJSON): void {
    if (request.resources.length === 0) {
      throw new BadRequest("GroupSpec must contain at least one resource unit");
    }

    for (let i = 0; i < request.resources.length; i++) {
      const resource = request.resources[i].resource;

      for (let j = 0; j < resource.storage.length; j++) {
        const vol = resource.storage[j];
        const isPersistent = vol.attributes.some(a => a.key === "persistent" && a.value === "true");
        const storageClass = vol.attributes.find(a => a.key === "class")?.value;
        const isRam = storageClass === "ram";

        if (isPersistent && (!storageClass || isRam)) {
          throw new BadRequest(`Persistent storage volume "${vol.name}" must specify a valid storage class (not "${storageClass || "empty"}")`);
        }
      }
    }
  }

  #toResult(candidate: BidScreeningCandidate): BidScreeningResult {
    return {
      owner: candidate.owner,
      hostUri: candidate.hostUri,
      region: candidate.ipRegion ?? null,
      uptime7d: candidate.uptime7d ?? null,
      isAudited: candidate.isAudited
    };
  }
}
