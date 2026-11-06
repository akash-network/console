import { subHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import type { UnmetDemandQuery, UnmetDemandResponse } from "@src/deployment/http-schemas/unmet-demand.schema";
import { buildUnmetDemandReport, type GpuVariantSupply } from "@src/deployment/lib/unmet-demand-report/unmet-demand-report";
import { UnmetDemandEventRepository } from "@src/deployment/repositories/unmet-demand-event/unmet-demand-event.repository";
import { GpuMarketPriceRepository } from "@src/gpu/repositories/gpu-market-price/gpu-market-price.repository";
import { GpuSupplyService } from "@src/gpu/services/gpu-supply/gpu-supply.service";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";

/** Counts a day as 24 hours, so a window over a daylight saving change is no shorter. */
const HOURS_PER_DAY = 24;

@singleton()
export class UnmetDemandReportService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly unmetDemandEventRepository: UnmetDemandEventRepository,
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly gpuSupplyService: GpuSupplyService,
    private readonly gpuMarketPriceRepository: GpuMarketPriceRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: UnmetDemandReportService.name });
  }

  async report({ days }: UnmetDemandQuery): Promise<UnmetDemandResponse> {
    const since = subHours(new Date(), days * HOURS_PER_DAY);
    const [summaries, hardwareRequests, supply, marketPrices] = await Promise.all([
      this.unmetDemandEventRepository.summarizeSince(since),
      this.hardwareRequestRepository.unscoped("platform-statistics").findRequestedGpusSince(since),
      this.#findSupply(),
      this.gpuMarketPriceRepository.findAllOrdered()
    ]);

    return { since: since.toISOString(), data: buildUnmetDemandReport({ summaries, hardwareRequests, supply, marketPrices }) };
  }

  /** Live supply reads the chain database, so the report still answers without it rather than failing on it. */
  async #findSupply(): Promise<GpuVariantSupply[] | null> {
    try {
      return await this.gpuSupplyService.listSupply({});
    } catch (error) {
      this.#logger.warn({ event: "UNMET_DEMAND_SUPPLY_UNAVAILABLE", error });
      return null;
    }
  }
}
