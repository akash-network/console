import type { LoggerService } from "@akashnetwork/logging";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import {
  DEFAULT_GPU_REQUEST_ROUTING_POLICY,
  type GpuRequestRoutingPolicy,
  gpuRequestRoutingPolicySchema
} from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import { type LaneRoutedRequest, type LaneRouting, routeHardwareRequest } from "@src/hardware-request/lib/hardware-request-lane/hardware-request-lane";
import { HardwareRequestAccountService } from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";

@singleton()
export class GpuRequestRoutingService {
  readonly #logger: LoggerService;

  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly hardwareRequestAccountService: HardwareRequestAccountService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: GpuRequestRoutingService.name });
  }

  /** Read on every call, so a payload changed in Unleash applies to the next request without a deploy. */
  getPolicy(): GpuRequestRoutingPolicy {
    const payload = this.featureFlagsService.getVariantPayload(FeatureFlags.GPU_REQUEST_ROUTING);

    if (payload === undefined) return DEFAULT_GPU_REQUEST_ROUTING_POLICY;

    const parsed = gpuRequestRoutingPolicySchema.safeParse(parseJson(payload));

    if (parsed.success) return parsed.data;

    this.#logger.warn({ event: "GPU_REQUEST_ROUTING_PAYLOAD_INVALID", issues: parsed.error.issues });
    return DEFAULT_GPU_REQUEST_ROUTING_POLICY;
  }

  async route(request: LaneRoutedRequest, requester: { userId: string; organizationId: string | null }): Promise<LaneRouting> {
    const accountType = await this.hardwareRequestAccountService.findAccountType(requester);

    return routeHardwareRequest(request, { hasPaymentMethod: accountType === "paying" }, this.getPolicy());
  }
}

function parseJson(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}
