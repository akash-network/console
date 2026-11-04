import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { HardwareRequestClaimService } from "./hardware-request-claim.service";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createOrganization } from "@test/seeders/organization.seeder";

describe(HardwareRequestClaimService.name, () => {
  it("claims the requests filed for the email into the user's personal organization and logs them", async () => {
    const { service, hardwareRequestRepository, organizationRepository, logger, organization } = setup();
    const claimed = [createHardwareRequest(), createHardwareRequest()];
    hardwareRequestRepository.claimByContactEmail.mockResolvedValue(claimed);

    await service.claimForVerifiedEmail({ id: "user-1", email: "jane@example.com" });

    expect(organizationRepository.findPersonalByUserId).toHaveBeenCalledWith("user-1");
    expect(hardwareRequestRepository.unscoped).toHaveBeenCalledWith("gpu-request-claim");
    expect(hardwareRequestRepository.claimByContactEmail).toHaveBeenCalledWith("jane@example.com", { userId: "user-1", organizationId: organization.id });
    expect(logger.info).toHaveBeenCalledWith({ event: "HARDWARE_REQUESTS_CLAIMED", userId: "user-1", hardwareRequestIds: claimed.map(request => request.id) });
  });

  it("claims without an organization for a user who has no personal one", async () => {
    const { service, hardwareRequestRepository, organizationRepository } = setup();
    organizationRepository.findPersonalByUserId.mockResolvedValue(undefined);

    await service.claimForVerifiedEmail({ id: "user-1", email: "jane@example.com" });

    expect(hardwareRequestRepository.claimByContactEmail).toHaveBeenCalledWith("jane@example.com", { userId: "user-1", organizationId: null });
  });

  it("logs nothing when no request was waiting", async () => {
    const { service, logger } = setup();

    await service.claimForVerifiedEmail({ id: "user-1", email: "jane@example.com" });

    expect(logger.info).not.toHaveBeenCalled();
  });

  it("does nothing for a user without an email", async () => {
    const { service, hardwareRequestRepository } = setup();

    await service.claimForVerifiedEmail({ id: "user-1", email: null });

    expect(hardwareRequestRepository.claimByContactEmail).not.toHaveBeenCalled();
  });

  it("logs under its own name", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: HardwareRequestClaimService.name });
  });

  function setup() {
    const organization = createOrganization({ type: "personal" });
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.unscoped.mockReturnValue(hardwareRequestRepository);
    hardwareRequestRepository.claimByContactEmail.mockResolvedValue([]);
    const organizationRepository = mock<OrganizationRepository>();
    organizationRepository.findPersonalByUserId.mockResolvedValue(organization);
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new HardwareRequestClaimService(hardwareRequestRepository, organizationRepository, createLogger);

    return { service, hardwareRequestRepository, organizationRepository, logger, createLogger, organization };
  }
});
