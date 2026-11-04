import { singleton } from "tsyringe";

import type { HardwareRequestAlertContext } from "@src/hardware-request/lib/hardware-request-alert-summary/hardware-request-alert-summary";
import { findSalesOwner } from "@src/hardware-request/lib/hardware-request-owner/hardware-request-owner";
import type { HardwareRequestOutput } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { GpuRequestRoutingService } from "@src/hardware-request/services/gpu-request-routing/gpu-request-routing.service";
import { HardwareRequestAccountService } from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";

@singleton()
export class HardwareRequestAlertContextService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly hardwareRequestAccountService: HardwareRequestAccountService,
    private readonly gpuRequestRoutingService: GpuRequestRoutingService
  ) {}

  async load({ userId, organizationId, owner }: HardwareRequestOutput): Promise<HardwareRequestAlertContext> {
    const organization = organizationId ? await this.organizationRepository.findById(organizationId) : undefined;

    return {
      organizationName: organization?.name,
      accountType: await this.hardwareRequestAccountService.findAccountType({ userId, organizationId }),
      owner: findSalesOwner(owner, this.gpuRequestRoutingService.getPolicy())
    };
  }
}
