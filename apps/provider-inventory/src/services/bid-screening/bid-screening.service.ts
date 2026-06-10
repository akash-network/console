import { withSpan } from "@akashnetwork/instrumentation";
import { singleton } from "tsyringe";

import { type BidScreeningCandidate, BidScreeningRepository } from "@src/repositories/bid-screening/bid-screening.repository";
import { ProviderIncidentRepository, RecentIncidentRow } from "@src/repositories/provider-incident/provider-incident.repository";
import type { GroupSpecJSON } from "../../mappers/groupspec-mapper/groupspec-mapper";
import { mapGroupSpecToResourceUnits } from "../../mappers/groupspec-mapper/groupspec-mapper";
import type { BidScreeningResult, Incident, RequestedResourceUnit } from "../../types/inventory";
import { ClusterInventoryMatcherService } from "../cluster-inventory-matcher/cluster-inventory-matcher.service";

const EMPTY_OBJECT = Object.freeze(Object.create(null));

@singleton()
export class BidScreeningService {
  readonly #repository: BidScreeningRepository;
  readonly #incidentRepository: ProviderIncidentRepository;
  readonly #matcher: ClusterInventoryMatcherService;

  constructor(repository: BidScreeningRepository, incidentRepository: ProviderIncidentRepository, matcher: ClusterInventoryMatcherService) {
    this.#repository = repository;
    this.#incidentRepository = incidentRepository;
    this.#matcher = matcher;
  }

  async findMatchingProviders(request: GroupSpecJSON): Promise<BidScreeningResult[]> {
    const resourceUnits = await withSpan("mapRequestToResourceUnits", async () => mapGroupSpecToResourceUnits(request));

    const candidates = await withSpan("fetchCandidatesFromDB", async ({ activeSpan }) => {
      const items = await this.#repository.findCandidates(resourceUnits, request.requirements);
      activeSpan.setAttribute("amountOfCandidatesFromDb", items.length);
      return items;
    });

    const matched = await withSpan("applyingBinPackingAlg", async ({ activeSpan }) => {
      const items = this.#filterProviders(candidates, resourceUnits);
      activeSpan.setAttribute("amountOfCandidatesAfterBinPacking", items.length);
      return items;
    });

    const incidentsByOwner = await withSpan("fetchIncidentsForMatched", async ({ activeSpan }) => {
      if (!matched.length) return EMPTY_OBJECT;
      const rows = await this.#incidentRepository.findRecentByProviders(matched.map(candidate => candidate.owner));
      activeSpan.setAttribute("amountOfIncidents", rows.length);

      const grouped = Object.create(null) as Partial<Record<string, Pick<RecentIncidentRow, "startedAt" | "endedAt">[]>>;
      for (const row of rows) {
        grouped[row.provider] ??= [];
        grouped[row.provider]!.push({ startedAt: row.startedAt, endedAt: row.endedAt });
      }
      return grouped;
    });

    return matched.map(candidate => this.#toResult(candidate, incidentsByOwner));
  }

  #filterProviders(candidates: BidScreeningCandidate[], resourceUnits: RequestedResourceUnit[]): BidScreeningCandidate[] {
    if (!candidates.length) return [];
    const matched: BidScreeningCandidate[] = [];

    for (const candidate of candidates) {
      const matchResult = this.#matcher.match(candidate.cluster, resourceUnits);

      if (matchResult.matched) {
        matched.push(candidate);
      }
    }

    return matched;
  }

  #toResult(candidate: BidScreeningCandidate, incidentsByOwner: Record<string, Incident[]>): BidScreeningResult {
    return {
      owner: candidate.owner,
      hostUri: candidate.hostUri,
      isAudited: candidate.isAudited,
      createdAt: candidate.createdAt,
      incidents: incidentsByOwner[candidate.owner] ?? []
    };
  }
}
