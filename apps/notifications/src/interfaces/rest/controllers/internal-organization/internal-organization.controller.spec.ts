import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/common/services/logger/logger.service";
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

  function setup(input: { channelsReleased: number }) {
    const notificationChannelRepository = mock<NotificationChannelRepository>();
    notificationChannelRepository.releaseAddressInOrganization.mockResolvedValue(input.channelsReleased);
    const loggerService = mock<LoggerService>();
    const controller = new InternalOrganizationController(notificationChannelRepository, loggerService);

    return { controller, notificationChannelRepository, loggerService };
  }
});
