import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import type { BrokerService } from "@src/infrastructure/broker";
import type { ClosureAlertService } from "@src/modules/alert/services/closure-alert/closure-alert.service";
import { ClosureAlertsHandler } from "./closure-alerts.handler";

describe(ClosureAlertsHandler.name, () => {
  describe("onModuleInit", () => {
    it("creates the queue with one waiting flush per channel before the handler subscribes", async () => {
      const { handler, brokerService } = setup();

      await handler.onModuleInit();

      expect(brokerService.createQueue).toHaveBeenCalledWith(
        eventKeyRegistry.closureAlertsDue,
        expect.objectContaining({ policy: "short", retryLimit: 10, retryBackoff: true })
      );
    });
  });

  describe("flush", () => {
    it("flushes the channel the job names", async () => {
      const { handler, closureAlertService } = setup();
      const notificationChannelId = faker.string.uuid();

      await handler.flush({ notificationChannelId });

      expect(closureAlertService.flush).toHaveBeenCalledWith(notificationChannelId);
    });
  });

  function setup() {
    const closureAlertService = mock<ClosureAlertService>();
    const brokerService = mock<BrokerService>();

    return { handler: new ClosureAlertsHandler(closureAlertService, brokerService), closureAlertService, brokerService };
  }
});
