import { withSpan } from "@akashnetwork/instrumentation";
import { singleton } from "tsyringe";

import { type BidScreeningCandidate, BidScreeningRepository } from "@src/repositories/bid-screening/bid-screening.repository";
import type { GroupSpecJSON } from "../../mappers/groupspec-mapper/groupspec-mapper";
import { mapGroupSpecToResourceUnits } from "../../mappers/groupspec-mapper/groupspec-mapper";
import type { BidScreeningResult, RequestedResourceUnit } from "../../types/inventory";
import { ClusterInventoryMatcherService } from "../cluster-inventory-matcher/cluster-inventory-matcher.service";

@singleton()
export class BidScreeningService {
  readonly #repository: BidScreeningRepository;
  readonly #matcher: ClusterInventoryMatcherService;

  constructor(repository: BidScreeningRepository, matcher: ClusterInventoryMatcherService) {
    this.#repository = repository;
    this.#matcher = matcher;
  }

  async findMatchingProviders(request: GroupSpecJSON): Promise<BidScreeningResult[]> {
    const resourceUnits = await withSpan("mapRequestToResourceUnits", async () => mapGroupSpecToResourceUnits(request));

    const candidates = await withSpan("fetchCandidatesFromDB", async ({ activeSpan }) => {
      const items = await this.#repository.findCandidates(resourceUnits, request.requirements);
      activeSpan.setAttribute("amountOfCandidatesFromDb", items.length);
      return items;
    });

    const results = await withSpan("applyingBinPackingAlg", async ({ activeSpan }) => {
      const items = this.#filterProviders(candidates, resourceUnits);
      activeSpan.setAttribute("amountOfCandidatesAfterBinPacking", items.length);
      return items;
    });

    return results;
  }

  #filterProviders(candidates: BidScreeningCandidate[], resourceUnits: RequestedResourceUnit[]): BidScreeningResult[] {
    const results: BidScreeningResult[] = [];

    for (const candidate of candidates) {
      const matchResult = this.#matcher.match(candidate.cluster, resourceUnits);

      if (matchResult.matched) {
        results.push(this.#toResult(candidate));
      }
    }

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
