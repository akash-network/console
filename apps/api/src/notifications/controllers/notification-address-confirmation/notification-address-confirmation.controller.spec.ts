import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { NotificationAddressConfirmationController } from "./notification-address-confirmation.controller";

describe(NotificationAddressConfirmationController.name, () => {
  it("confirms the address of the link's token", async () => {
    const { controller, notificationService } = setup({ confirms: true });

    await controller.create("link-token");

    expect(notificationService.confirmAddress).toHaveBeenCalledWith("link-token");
  });

  it("answers 400 for a link that confirms nothing", async () => {
    const { controller } = setup({ confirms: false });

    await expect(controller.create("used-token")).rejects.toMatchObject({ status: 400, message: "The confirmation link is invalid or was already used" });
  });

  function setup(input: { confirms: boolean }) {
    const notificationService = mock<NotificationService>();
    notificationService.confirmAddress.mockResolvedValue(input.confirms);

    return { controller: new NotificationAddressConfirmationController(notificationService), notificationService };
  }
});
