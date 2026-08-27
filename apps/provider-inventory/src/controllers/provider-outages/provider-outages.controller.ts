import { singleton } from "tsyringe";

import type { ProviderOutagesRequest, ProviderOutagesResponse } from "@src/http-schemas/provider-outages.schema";
import { ProviderIncidentRepository } from "@src/repositories/provider-incident/provider-incident.repository";

@singleton()
export class ProviderOutagesController {
  readonly #incidentRepository: ProviderIncidentRepository;

  constructor(incidentRepository: ProviderIncidentRepository) {
    this.#incidentRepository = incidentRepository;
  }

  async getOngoingOutages(request: ProviderOutagesRequest): Promise<ProviderOutagesResponse> {
    const outages = await this.#incidentRepository.findOutagesStartedBefore(request.minAgeDays);

    return {
      outages: outages.map(outage => ({
        provider: outage.provider,
        hostUri: outage.hostUri,
        startedAt: outage.startedAt.toISOString(),
        lastAttemptAt: outage.lastAttemptAt.toISOString()
      }))
    };
  }
}
