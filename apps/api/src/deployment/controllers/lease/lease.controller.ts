import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { type GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { type CreateLeaseRequest } from "@src/deployment/http-schemas/lease.schema";
import { type FallbackLeaseListResponse } from "@src/deployment/http-schemas/lease-rpc.schema";
import { DatabaseLeaseListParams } from "@src/deployment/repositories/lease/lease.repository";
import { LeaseService } from "@src/deployment/services/lease/lease.service";

@singleton()
export class LeaseController {
  constructor(
    private readonly leaseService: LeaseService,
    private readonly authService: AuthService
  ) {}

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async createLeasesAndSendManifest(input: CreateLeaseRequest): Promise<GetDeploymentResponse> {
    const result = await this.leaseService.createLeasesAndSendManifest({
      ...input,
      userId: this.authService.currentUser.id
    });
    return { data: result };
  }

  async listLeasesFallback(params: DatabaseLeaseListParams): Promise<FallbackLeaseListResponse> {
    return await this.leaseService.listLeasesFallback(params);
  }
}
