import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { inject, singleton } from "tsyringe";

import { BidController } from "@src/bid/controllers/bid/bid.controller";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import { BidScreeningHttpService } from "@src/deployment/services/bid-screening-http/bid-screening-http.service";
import { PlacementOptionsHttpService } from "@src/deployment/services/placement-options-http/placement-options-http.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { extractRequestedGpusFromGroupSpecs } from "@src/deployment/utils/blocked-gpu/blocked-gpu";
import type { ReadToolArguments } from "@src/feedback/lib/assistant-tools/assistant-tool-arguments";

export interface GroupAvailability {
  group: string;
  requestedGpus: string[];
  providersAbleToBid: number | null;
}

@singleton()
export class AssistantBidToolsService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly bidController: BidController,
    private readonly deploymentController: DeploymentController,
    private readonly sdlService: SdlService,
    private readonly bidScreeningHttpService: BidScreeningHttpService,
    private readonly placementOptionsHttpService: PlacementOptionsHttpService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AssistantBidToolsService.name });
  }

  /** Screens availability only for a deployment still waiting on its first bid, since that is the only case it explains. */
  async getBids({ dseq }: ReadToolArguments<"get_bids">) {
    const [{ data: bids }, { data: deployment }] = await Promise.all([this.bidController.list(dseq), this.deploymentController.findByDseq(dseq)]);
    const isWaitingOnBids = deployment.deployment.state === "active" && deployment.leases.length === 0 && !bids.some(({ bid }) => bid.state === "open");

    return {
      dseq,
      deploymentState: deployment.deployment.state,
      leaseCount: deployment.leases.length,
      bids: bids.map(({ bid }) => ({
        gseq: bid.id.gseq,
        oseq: bid.id.oseq,
        provider: bid.id.provider,
        state: bid.state,
        price: bid.price,
        reclamationWindow: bid.reclamation_window ?? null
      })),
      availability: isWaitingOnBids ? await this.#availabilityOf(deployment.consoleSettings?.sdl) : null
    };
  }

  async #availabilityOf(sdl: string | undefined) {
    if (!sdl) return null;

    const manifest = await this.sdlService.generateManifest(sdl);
    if (!manifest.ok) return null;

    const groupSpecs = manifest.value.groupSpecs;
    const requestsGpus = extractRequestedGpusFromGroupSpecs(groupSpecs).length > 0;
    const [groups, gpuModelsWithFreeCapacity] = await Promise.all([
      Promise.all(groupSpecs.map(groupSpec => this.#screen(groupSpec))),
      requestsGpus ? this.#findAvailableGpuModels() : null
    ]);

    return { groups, gpuModelsWithFreeCapacity };
  }

  async #screen(groupSpec: GroupSpec): Promise<GroupAvailability> {
    const requestedGpus = extractRequestedGpusFromGroupSpecs([groupSpec]).map(({ vendor, model }) => `${vendor}/${model}`);

    try {
      return { group: groupSpec.name, requestedGpus, providersAbleToBid: (await this.bidScreeningHttpService.findScreenedProviders(groupSpec)).length };
    } catch (error) {
      this.#logger.warn({ event: "ASSISTANT_BID_SCREENING_FAILED", error });
      return { group: groupSpec.name, requestedGpus, providersAbleToBid: null };
    }
  }

  async #findAvailableGpuModels(): Promise<string[] | null> {
    try {
      return (await this.placementOptionsHttpService.findAvailableGpuModels()).map(({ vendor, model }) => `${vendor}/${model}`);
    } catch (error) {
      this.#logger.warn({ event: "ASSISTANT_PLACEMENT_OPTIONS_FAILED", error });
      return null;
    }
  }
}
