import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/common/services/logger/logger.service";
import type { OrganizationPurgeService } from "@src/interfaces/rest/services/organization-purge/organization-purge.service";
import type { NotificationChannelRepository } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import { InternalOrganizationController } from "./internal-organization.controller";

describe(InternalOrganizationController.name, () => {
  describe("releaseDepartedMember", () => {
    it("releases the departed member's address across the organization's channels and logs how many changed", async () => {
      const { controller, notificationChannelRepository, loggerService } = setup({ channelsReleased: 2 });
      const organizationId = faker.string.uuid();
      const data = { addressSha256: faker.string.hexadecimal({ length: 64, prefix: "", casing: "lower" }), fallbackAddresses: [faker.internet.email()] };

      await controller.releaseDepartedMember(organizationId, { data });

      expect(notificationChannelRepository.releaseAddressInOrganization).toHaveBeenCalledWith({ organizationId, ...data });
      expect(loggerService.log).toHaveBeenCalledWith({ event: "DEPARTED_MEMBER_RELEASED_FROM_CHANNELS", organizationId, channelsReleased: 2 });
    });
  });

  describe("purgeOrganization", () => {
    it("purges the organization's alerts and channels and logs how many went", async () => {
      const { controller, organizationPurgeService, loggerService } = setup({ purged: { alertsDeleted: 3, channelsDeleted: 2 } });
      const organizationId = faker.string.uuid();

      await controller.purgeOrganization(organizationId);

      expect(organizationPurgeService.purge).toHaveBeenCalledWith(organizationId);
      expect(loggerService.log).toHaveBeenCalledWith({ event: "ORGANIZATION_PURGE_COMPLETED", organizationId, alertsDeleted: 3, channelsDeleted: 2 });
    });
  });

  function setup(input: { channelsReleased?: number; purged?: { alertsDeleted: number; channelsDeleted: number } }) {
    const notificationChannelRepository = mock<NotificationChannelRepository>();
    notificationChannelRepository.releaseAddressInOrganization.mockResolvedValue(input.channelsReleased ?? 0);
    const organizationPurgeService = mock<OrganizationPurgeService>();
    organizationPurgeService.purge.mockResolvedValue(input.purged ?? { alertsDeleted: 0, channelsDeleted: 0 });
    const loggerService = mock<LoggerService>();
    const controller = new InternalOrganizationController(notificationChannelRepository, organizationPurgeService, loggerService);

    return { controller, notificationChannelRepository, organizationPurgeService, loggerService };
  }
});
