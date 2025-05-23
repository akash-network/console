import { ServiceUnavailableException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import type { HealthzService, HealthzStatus } from "@src/common/types/healthz.type";
import { HealthzHelperService } from "./healthz-helper.service";

describe(HealthzHelperService.name, () => {
  it("should be defined", async () => {
    const { service } = await setup();
    expect(service).toBeDefined();
  });

  describe("summarize", () => {
    it("returns ok when all services are healthy", async () => {
      const { service, dbService, brokerService } = await setup({
        dbStatus: "ok",
        brokerStatus: "ok"
      });

      const result = await service.summarize("readiness", [dbService, brokerService]);

      expect(result).toEqual({
        status: "ok",
        data: {
          db: { postgres: true },
          broker: { postgres: true, broker: true }
        }
      });
    });

    it("returns error when one service is unhealthy", async () => {
      const { service, dbService, brokerService } = await setup({
        dbStatus: "ok",
        brokerStatus: "error"
      });

      const result = await service.summarize("readiness", [dbService, brokerService]);

      expect(result.status).toBe("error");
      expect(result.data).toEqual({
        db: { postgres: true },
        broker: { postgres: true, broker: true }
      });
    });
  });

  describe("throwUnlessHealthy", () => {
    it("throws when a service is unhealthy", async () => {
      const { service, brokerService } = await setup({
        brokerStatus: "error"
      });

      await expect(service.throwUnlessHealthy("liveness", brokerService)).rejects.toThrow(ServiceUnavailableException);
    });

    it("returns result when all services are healthy", async () => {
      const { service, dbService } = await setup({
        dbStatus: "ok"
      });

      const result = await service.throwUnlessHealthy("liveness", dbService);

      expect(result).toEqual({
        status: "ok",
        data: {
          db: { postgres: true }
        }
      });
    });
  });

  async function setup(opts?: { dbStatus?: HealthzStatus; brokerStatus?: HealthzStatus }): Promise<{
    module: TestingModule;
    service: HealthzHelperService;
    dbService: HealthzService;
    brokerService: HealthzService;
  }> {
    const module = await Test.createTestingModule({
      providers: [HealthzHelperService]
    }).compile();

    const dbResult = {
      status: opts?.dbStatus ?? "ok",
      data: { postgres: true }
    };

    const brokerResult = {
      status: opts?.brokerStatus ?? "ok",
      data: { postgres: true, broker: true }
    };

    const dbService: HealthzService = {
      name: "db",
      getReadinessStatus: jest.fn(() => Promise.resolve(dbResult)),
      getLivenessStatus: jest.fn(() => Promise.resolve(dbResult))
    };

    const brokerService: HealthzService = {
      name: "broker",
      getReadinessStatus: jest.fn(() => Promise.resolve(brokerResult)),
      getLivenessStatus: jest.fn(() => Promise.resolve(brokerResult))
    };

    return {
      module,
      service: module.get(HealthzHelperService),
      dbService,
      brokerService
    };
  }
});
