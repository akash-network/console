import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";

import type { HealthzService } from "@src/healthz/services/healthz/healthz.service";
import { HealthzController } from "./healthz.controller";

describe(HealthzController.name, () => {
  it("should be defined", () => {
    expect(HealthzController).toBeDefined();
  });

  describe("getReadinessStatus", () => {
    it("should return ok if postgres is ready", async () => {
      const { controller, service } = await setup();

      service.getReadinessStatus.mockResolvedValue({
        status: "ok",
        data: {
          postgres: true
        }
      });

      const result = await controller.getReadinessStatus();

      expect(result).toEqual({
        status: "ok",
        data: { postgres: true }
      });
    });
  });

  describe("getLivenessStatus", () => {
    it("should return ok if postgres is ready", async () => {
      const { controller, service } = await setup();

      service.getLivenessStatus.mockResolvedValue({
        status: "ok",
        data: { postgres: true }
      });

      const result = await controller.getLivenessStatus();

      expect(result).toEqual({
        status: "ok",
        data: { postgres: true }
      });
    });
  });

  function setup(): {
    controller: HealthzController;
    service: MockProxy<HealthzService>;
  } {
    const service = mock<HealthzService>();
    const controller = new HealthzController(service);

    return {
      controller,
      service
    };
  }
});
