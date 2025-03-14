import { LoggerService } from "@akashnetwork/logging";
import { millisecondsInMinute } from "date-fns";
import { sql } from "drizzle-orm";
import { mock, MockProxy } from "jest-mock-extended";

import { ApiPgDatabase } from "@src/core/providers/postgres.provider";
import { HealthzService } from "./healthz.service";

describe(HealthzService.name, () => {
  describe("getReadinessStatus", () => {
    it("should return ok if postgres is ready", async () => {
      const { service, pg } = await setup();

      expect(await service.getReadinessStatus()).toEqual({
        status: "ok",
        data: {
          postgres: true
        }
      });
      expect(pg.execute).toHaveBeenCalledWith(sql`SELECT 1`);
    });

    it("should return error if postgres is not ready", async () => {
      const { service, pg } = await setup();

      pg.execute.mockRejectedValue(new Error("Postgres is not ready"));

      expect(await service.getReadinessStatus()).toEqual({
        status: "error",
        data: {
          postgres: false
        }
      });
      expect(pg.execute).toHaveBeenCalledWith(sql`SELECT 1`);
    });
  });

  describe("getLivenessStatus", () => {
    it("should return ok if postgres is ready", async () => {
      const { service, pg } = await setup();

      expect(await service.getLivenessStatus()).toEqual({
        status: "ok",
        data: {
          postgres: true
        }
      });
      expect(pg.execute).toHaveBeenCalledWith(sql`SELECT 1`);
    });

    it("should return ok if postgres is not ready before the threshold", async () => {
      const { service, pg, logger } = await setup();
      const error = new Error("Postgres is not ready");
      pg.execute.mockRejectedValue(error);

      expect(await service.getLivenessStatus()).toEqual({
        status: "ok",
        data: {
          postgres: true
        }
      });
      expect(pg.execute).toHaveBeenCalledWith(sql`SELECT 1`);
      expect(logger.error).toHaveBeenCalledWith(error);
    });

    it("should return error if postgres is not ready after the threshold", async () => {
      const { service, pg, logger } = await setup();
      const error = new Error("Postgres is not ready");
      pg.execute.mockRejectedValue(error);

      await service.getLivenessStatus();

      jest.useFakeTimers();
      jest.advanceTimersByTime(millisecondsInMinute + 1);

      expect(await service.getLivenessStatus()).toEqual({
        status: "error",
        data: {
          postgres: false
        }
      });
      expect(pg.execute).toHaveBeenCalledWith(sql`SELECT 1`);
      expect(logger.error).toHaveBeenCalledWith(error);
    });
  });

  function setup(): {
    pg: MockProxy<ApiPgDatabase>;
    logger: MockProxy<LoggerService>;
    service: HealthzService;
  } {
    const pg = mock<ApiPgDatabase>();
    const logger = mock<LoggerService>();
    const healthzService = new HealthzService(pg, logger);

    return {
      pg,
      logger,
      service: healthzService
    };
  }
});
