import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { gpuRequestRoutingPolicySchema } from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import type { GpuRequestRoutingService } from "@src/hardware-request/services/gpu-request-routing/gpu-request-routing.service";
import type { HardwareRequestAccountService } from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";
import type { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { HardwareRequestAlertContextService } from "./hardware-request-alert-context.service";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createOrganization } from "@test/seeders/organization.seeder";

describe(HardwareRequestAlertContextService.name, () => {
  it("loads the organization's name, the account type and the owner named on the request", async () => {
    const { service, organizationRepository, hardwareRequestAccountService } = setup();
    const organization = createOrganization({ name: "Acme" });
    organizationRepository.findById.mockResolvedValue(organization);
    hardwareRequestAccountService.findAccountType.mockResolvedValue("paying");
    const hardwareRequest = createHardwareRequest({ organizationId: organization.id, owner: "Remington" });

    await expect(service.load(hardwareRequest)).resolves.toEqual({
      organizationName: "Acme",
      accountType: "paying",
      owner: { name: "Remington", slackUserId: "U2", match: {} }
    });
    expect(organizationRepository.findById).toHaveBeenCalledWith(organization.id);
    expect(hardwareRequestAccountService.findAccountType).toHaveBeenCalledWith({ userId: hardwareRequest.userId, organizationId: organization.id });
  });

  it("loads no organization for a request without one", async () => {
    const { service, organizationRepository } = setup();

    const context = await service.load(createHardwareRequest({ organizationId: null, owner: null }));

    expect(context).toMatchObject({ organizationName: undefined, owner: undefined });
    expect(organizationRepository.findById).not.toHaveBeenCalled();
  });

  function setup() {
    const organizationRepository = mock<OrganizationRepository>();
    const hardwareRequestAccountService = mock<HardwareRequestAccountService>();
    hardwareRequestAccountService.findAccountType.mockResolvedValue("trial");
    const gpuRequestRoutingService = mock<GpuRequestRoutingService>();
    gpuRequestRoutingService.getPolicy.mockReturnValue(gpuRequestRoutingPolicySchema.parse({ owners: [{ name: "Remington", slackUserId: "U2" }] }));
    const service = new HardwareRequestAlertContextService(organizationRepository, hardwareRequestAccountService, gpuRequestRoutingService);

    return { service, organizationRepository, hardwareRequestAccountService };
  }
});
