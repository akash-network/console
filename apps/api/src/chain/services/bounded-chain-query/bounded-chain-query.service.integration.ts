import { DatabaseError, QueryTypes } from "sequelize";
import { container } from "tsyringe";
import { beforeAll, describe, expect, it } from "vitest";

import { CHAIN_DB } from "@src/chain/providers/sequelize.provider";
import type { ChainConfigService } from "@src/chain/services/chain-config/chain-config.service";
import { BoundedChainQueryService } from "./bounded-chain-query.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

describe(BoundedChainQueryService.name, () => {
  beforeAll(async () => {
    await container.resolve(CHAIN_DB).authenticate();
  });

  describe("select", () => {
    it("answers the rows of a query that finishes in time", async () => {
      const { service } = setup({ timeoutMs: 5_000 });

      const rows = await service.select<{ value: number }>("SELECT :value::int AS value", { value: 7 });

      expect(rows).toEqual([{ value: 7 }]);
    });

    it("runs the query under the configured statement timeout", async () => {
      const { service } = setup({ timeoutMs: 4_321 });

      const rows = await service.select<{ statement_timeout: string }>("SHOW statement_timeout", {});

      expect(rows).toEqual([{ statement_timeout: "4321ms" }]);
    });

    it("answers 503 when the query outlasts the statement timeout", async () => {
      const { service } = setup({ timeoutMs: 50 });

      await expect(service.select("SELECT pg_sleep(2)", {})).rejects.toMatchObject({ status: 503, message: "Chain data query timed out" });
    });

    it("hands the connection back with its default statement timeout", async () => {
      const { service, readStatementTimeoutSetting } = setup({ timeoutMs: 4_321 });

      await service.select("SELECT 1", {});
      const { setting, defaultSetting } = await readStatementTimeoutSetting();

      expect(setting).toBe(defaultSetting);
    });

    it("rethrows a database error that is not a timeout", async () => {
      const { service } = setup({ timeoutMs: 5_000 });

      await expect(service.select("SELECT * FROM table_that_does_not_exist", {})).rejects.toBeInstanceOf(DatabaseError);
    });

    it("rethrows an error raised before the query reaches the database", async () => {
      const { service } = setup({ timeoutMs: 5_000 });

      await expect(service.select("SELECT :missing AS value", {})).rejects.toThrow('Named replacement ":missing" has no entry in the replacement map.');
    });
  });

  function setup(input: { timeoutMs: number }) {
    const chainDb = container.resolve(CHAIN_DB);
    const service = new BoundedChainQueryService(chainDb, mockConfigService<ChainConfigService>({ BOUNDED_CHAIN_QUERY_TIMEOUT_MS: input.timeoutMs }));
    const readStatementTimeoutSetting = async () => {
      const [row] = await chainDb.query<{ setting: string; defaultSetting: string }>(
        `SELECT setting, reset_val AS "defaultSetting" FROM pg_settings WHERE name = 'statement_timeout'`,
        { type: QueryTypes.SELECT }
      );
      return row;
    };

    return { service, readStatementTimeoutSetting };
  }
});
