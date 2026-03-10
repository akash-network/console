import { ServiceUnavailableException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { HealthzHelperService } from "@src/common/services/healthz-helper/healthz-helper.service";
import { BrokerHealthzService } from "@src/infrastructure/broker/services/broker-healthz/broker-healthz.service";
import { DbHealthzService } from "@src/infrastructure/db/services/db-healthz/db-healthz.service";
import { ChainEventsPollerService } from "@src/modules/chain/services/chain-events-poller/chain-events-poller.service";
import { HealthzController } from "./healthz.controller";

import { MockProvider } from "@test/mocks/provider.mock";

describe(HealthzController.name, () => {
  describe("getReadiness", () => {
    it("passes all services including chain events poller to healthz helper", async () => {
      const { controller, healthzHelperService, dbHealthzService, brokerHealthzService, chainEventsPollerService } = await setup();
      healthzHelperService.throwUnlessHealthy.mockResolvedValue({ status: "ok", data: {} });

      await controller.getReadiness();

      expect(healthzHelperService.throwUnlessHealthy).toHaveBeenCalledWith("readiness", dbHealthzService, brokerHealthzService, chainEventsPollerService);
    });

    it("throws when healthz helper throws", async () => {
      const { controller, healthzHelperService } = await setup();
      healthzHelperService.throwUnlessHealthy.mockRejectedValue(new ServiceUnavailableException());

      await expect(controller.getReadiness()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe("getLiveness", () => {
    it("passes all services including chain events poller to healthz helper", async () => {
      const { controller, healthzHelperService, dbHealthzService, brokerHealthzService, chainEventsPollerService } = await setup();
      healthzHelperService.throwUnlessHealthy.mockResolvedValue({ status: "ok", data: {} });

      await controller.getLiveness();

      expect(healthzHelperService.throwUnlessHealthy).toHaveBeenCalledWith("liveness", dbHealthzService, brokerHealthzService, chainEventsPollerService);
    });

    it("throws when healthz helper throws", async () => {
      const { controller, healthzHelperService } = await setup();
      healthzHelperService.throwUnlessHealthy.mockRejectedValue(new ServiceUnavailableException());

      await expect(controller.getLiveness()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  async function setup(): Promise<{
    module: TestingModule;
    controller: HealthzController;
    healthzHelperService: MockProxy<HealthzHelperService>;
    dbHealthzService: MockProxy<DbHealthzService>;
    brokerHealthzService: MockProxy<BrokerHealthzService>;
    chainEventsPollerService: MockProxy<ChainEventsPollerService>;
  }> {
    const module = await Test.createTestingModule({
      controllers: [HealthzController],
      providers: [
        MockProvider(HealthzHelperService),
        MockProvider(DbHealthzService),
        MockProvider(BrokerHealthzService),
        MockProvider(ChainEventsPollerService)
      ]
    }).compile();

    return {
      module,
      controller: module.get(HealthzController),
      healthzHelperService: module.get(HealthzHelperService),
      dbHealthzService: module.get(DbHealthzService),
      brokerHealthzService: module.get(BrokerHealthzService),
      chainEventsPollerService: module.get(ChainEventsPollerService)
    };
  }
});
