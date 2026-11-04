import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";

@singleton()
export class HardwareRequestClaimService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly organizationRepository: OrganizationRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: HardwareRequestClaimService.name });
  }

  /** Callers vouch the address is verified, since proving it is what hands over the requests the team filed for it. */
  async claimForVerifiedEmail(user: { id: string; email: string | null }): Promise<void> {
    if (!user.email) return;

    const organization = await this.organizationRepository.findPersonalByUserId(user.id);
    const claimed = await this.hardwareRequestRepository
      .unscoped("gpu-request-claim")
      .claimByContactEmail(user.email, { userId: user.id, organizationId: organization?.id ?? null });

    if (claimed.length > 0) {
      this.#logger.info({ event: "HARDWARE_REQUESTS_CLAIMED", userId: user.id, hardwareRequestIds: claimed.map(request => request.id) });
    }
  }
}
