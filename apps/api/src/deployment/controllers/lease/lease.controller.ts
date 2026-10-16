import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { type CreateLeaseResponse } from "@src/deployment/http-schemas/deployment.schema";
import { type CreateLeaseAcceptedResponse, type CreateLeaseQuery, type CreateLeaseRequest } from "@src/deployment/http-schemas/lease.schema";
import { type FallbackLeaseListResponse } from "@src/deployment/http-schemas/lease-rpc.schema";
import { DatabaseLeaseListParams } from "@src/deployment/repositories/lease/lease.repository";
import { FallbackLeaseReaderService } from "@src/deployment/services/fallback-lease-reader/fallback-lease-reader.service";
import { LeaseService } from "@src/deployment/services/lease/lease.service";

@singleton()
export class LeaseController {
  constructor(
    private readonly fallbackLeaseReaderService: FallbackLeaseReaderService,
    private readonly leaseService: LeaseService,
    private readonly authService: AuthService,
    private readonly featureFlagsService: FeatureFlagsService
  ) {}

  /** The flag is read here rather than in the worker, because inside a job every user evaluates as the background-job user. */
  @Protected([{ action: "sign", subject: "UserWallet" }])
  async createLeasesAndSendManifest(
    input: CreateLeaseRequest,
    query: CreateLeaseQuery = { async: false }
  ): Promise<CreateLeaseResponse | CreateLeaseAcceptedResponse> {
    const userId = this.authService.currentUser.id;

    if (query.async && this.featureFlagsService.isEnabled(FeatureFlags.BACKGROUND_LEASE_CREATE, { userId })) {
      const queued = await this.leaseService.createLeasesInBackground({ ...input, userId });
      if (queued) return { data: queued };
    }

    const data = await this.leaseService.createLeasesAndSendManifest({ ...input, userId });
    return { data };
  }

  async listLeasesFallback(params: DatabaseLeaseListParams): Promise<FallbackLeaseListResponse> {
    return await this.fallbackLeaseReaderService.list(params);
  }
}
