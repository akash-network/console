import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { millisecondsInMinute } from "date-fns/constants";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { QueryResult } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { DbHealthzService } from "./db-healthz.service";

import { MockProvider } from "@test/mocks/provider.mock";

describe(DbHealthzService.name, () => {
  it("should be defined", async () => {
    const { service } = await setup();
    expect(service).toBeDefined();
  });

  describe("getReadinessStatus", () => {
    it("returns ok when db is ready", async () => {
      const { service, db } = await setup();
      db.execute.mockResolvedValueOnce(mockQueryResult());

      const result = await service.getReadinessStatus();

      expect(result).toEqual({
        status: "ok",
        data: { postgres: true }
      });
    });

    it("returns error when db is not ready", async () => {
      const { service, db } = await setup();
      db.execute.mockRejectedValueOnce(new Error("fail"));

      const result = await service.getReadinessStatus();

      expect(result).toEqual({
        status: "error",
        data: { postgres: false }
      });
    });
  });

  describe("getLivenessStatus", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns ok if db is alive", async () => {
      const { service, db } = await setup();
      db.execute.mockResolvedValueOnce(mockQueryResult());

      const result = await service.getLivenessStatus();

      expect(result.status).toBe("ok");
      expect(result.data.postgres).toBe(true);
    });

    it("returns ok if db failed recently (within threshold)", async () => {
      const { service, db } = await setup();

      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      db.execute.mockRejectedValueOnce(new Error("fail"));
      await service.getLivenessStatus();

      vi.setSystemTime(new Date("2025-01-01T00:00:30Z"));
      db.execute.mockRejectedValueOnce(new Error("fail"));

      const result = await service.getLivenessStatus(millisecondsInMinute);

      expect(result.status).toBe("ok");
      expect(result.data.postgres).toBe(true);
    });

    it("returns error if db failed long ago (exceeds threshold)", async () => {
      const { service, db } = await setup();

      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      db.execute.mockRejectedValueOnce(new Error("fail"));
      await service.getLivenessStatus();

      vi.setSystemTime(new Date("2025-01-01T00:02:00Z"));
      db.execute.mockRejectedValueOnce(new Error("fail"));

      const result = await service.getLivenessStatus(millisecondsInMinute);

      expect(result.status).toBe("error");
      expect(result.data.postgres).toBe(false);
    });
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: DbHealthzService;
    db: MockProxy<NodePgDatabase<any>>;
    logger: MockProxy<LoggerService>;
  }> {
    const module = await Test.createTestingModule({
      providers: [DbHealthzService, MockProvider(LoggerService), MockProvider<NodePgDatabase<any>>(DRIZZLE_PROVIDER_TOKEN)]
    }).compile();

    return {
      module,
      service: module.get(DbHealthzService),
      db: module.get<MockProxy<NodePgDatabase<any>>>(DRIZZLE_PROVIDER_TOKEN),
      logger: module.get(LoggerService)
    };
  }

  function mockQueryResult(): QueryResult<Record<string, unknown>> {
    return {
      rows: [],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }
});
