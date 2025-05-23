import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { millisecondsInMinute } from "date-fns/constants";
import { type MockProxy } from "jest-mock-extended";
import { Client } from "pg";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { StateService } from "@src/infrastructure/broker/services/state/state.service";
import { BrokerHealthzService } from "./broker-healthz.service";

import { MockProvider } from "@test/mocks/provider.mock";

describe(BrokerHealthzService.name, () => {
  it("should be defined", async () => {
    const { service } = await setup();
    expect(service).toBeDefined();
  });

  describe("getReadinessStatus", () => {
    it("returns ok when db and broker are ready", async () => {
      const { service, db, stateService } = await setup();
      db.query.mockResolvedValueOnce({} as never);
      stateService.getState.mockReturnValue("active");

      const result = await service.getReadinessStatus();

      expect(result).toEqual({
        status: "ok",
        data: {
          postgres: true,
          broker: true
        }
      });
    });

    it("returns error when db fails", async () => {
      const { service, db, stateService } = await setup();
      db.query.mockRejectedValueOnce(new Error("fail") as never);
      stateService.getState.mockReturnValue("active");

      const result = await service.getReadinessStatus();

      expect(result.status).toBe("error");
      expect(result.data).toEqual({
        postgres: false,
        broker: true
      });
    });

    it("returns error when broker is inactive", async () => {
      const { service, db, stateService } = await setup();
      db.query.mockResolvedValueOnce({} as never);
      stateService.getState.mockReturnValue("stopped");

      const result = await service.getReadinessStatus();

      expect(result.status).toBe("error");
      expect(result.data).toEqual({
        postgres: true,
        broker: false
      });
    });
  });

  describe("getLivenessStatus", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns ok if db is alive", async () => {
      const { service, db } = await setup();
      db.query.mockResolvedValueOnce({} as never);

      const result = await service.getLivenessStatus();

      expect(result.status).toBe("ok");
      expect(result.data.postgres).toBe(true);
    });

    it("returns ok if db failed recently (within threshold)", async () => {
      const { service, db } = await setup();

      const failureTime = new Date("2025-01-01T00:00:00Z");
      jest.setSystemTime(failureTime);
      db.query.mockRejectedValueOnce(new Error("fail") as never);
      await service.getLivenessStatus();

      jest.setSystemTime(new Date("2025-01-01T00:00:30Z"));
      db.query.mockRejectedValueOnce(new Error("fail") as never);

      const result = await service.getLivenessStatus(millisecondsInMinute);

      expect(result.status).toBe("ok");
      expect(result.data.postgres).toBe(true);
    });

    it("returns error if db failed long ago (exceeds threshold)", async () => {
      const { service, db } = await setup();

      const failureTime = new Date("2025-01-01T00:00:00Z");
      jest.setSystemTime(failureTime);
      db.query.mockRejectedValueOnce(new Error("fail") as never);
      await service.getLivenessStatus();

      jest.setSystemTime(new Date("2025-01-01T00:02:00Z"));
      db.query.mockRejectedValueOnce(new Error("fail") as never);

      const result = await service.getLivenessStatus(millisecondsInMinute);

      expect(result.status).toBe("error");
      expect(result.data.postgres).toBe(false);
    });
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: BrokerHealthzService;
    db: MockProxy<Client>;
    stateService: MockProxy<StateService>;
    logger: MockProxy<LoggerService>;
  }> {
    const module = await Test.createTestingModule({
      providers: [BrokerHealthzService, MockProvider(Client), MockProvider(StateService), MockProvider(LoggerService)]
    }).compile();

    return {
      module,
      service: module.get(BrokerHealthzService),
      db: module.get(Client),
      stateService: module.get(StateService),
      logger: module.get(LoggerService)
    };
  }
});
