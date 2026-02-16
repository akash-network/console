import { ConfigService } from "@nestjs/config";
import { mock } from "jest-mock-extended";
import type { Pool, QueryResult } from "pg";
import type { PgBoss } from "pg-boss";

import { createPgBossFactory } from "./pg-boss.provider";

import { generateBrokerConfig } from "@test/seeders/broker-config.seeder";

describe("createPgBoss", () => {
  it("should create and start a PgBoss instance", async () => {
    const config = generateBrokerConfig();
    const pool = mock<Pool>();

    const mockInstance = mock<PgBoss>();

    mockInstance.start.mockResolvedValue(mockInstance);

    const MockPgBoss = jest
      .fn()
      .mockImplementationOnce(() => mockInstance)
      .mockImplementationOnce(() => mockInstance);

    const pgBoss = await createPgBossFactory(MockPgBoss as unknown as typeof PgBoss)(new ConfigService(config), pool);

    expect(MockPgBoss).toHaveBeenCalledTimes(2);
    expect(MockPgBoss.mock.calls[0][0]).toEqual(config["broker.EVENT_BROKER_POSTGRES_URI"]);
    expect(MockPgBoss.mock.calls[1][0]).toEqual({
      db: {
        executeSql: expect.any(Function)
      }
    });
    expect(mockInstance.start).toHaveBeenCalledTimes(2);
    expect(mockInstance.stop).toHaveBeenCalledTimes(1);
    expect(pgBoss).toBe(mockInstance);
  });

  it("should use pool.query for executeSql", async () => {
    const config = generateBrokerConfig();
    const pool = mock<Pool>();

    const mockQueryResult: QueryResult = {
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      rows: [],
      fields: []
    };

    pool.query.mockImplementation(() => Promise.resolve(mockQueryResult));

    type ExecuteSqlFn = (text: string, values: any[]) => Promise<{ rows: any[] }>;
    let capturedExecuteSql: ExecuteSqlFn | undefined;

    const mockInstance = mock<PgBoss>();
    mockInstance.start.mockResolvedValue(mockInstance);

    const MockPgBoss = jest
      .fn()
      .mockImplementationOnce(() => mockInstance)
      .mockImplementationOnce(options => {
        capturedExecuteSql = options.db.executeSql;
        return mockInstance;
      });

    await createPgBossFactory(MockPgBoss as unknown as typeof PgBoss)(new ConfigService(config), pool);

    const sql = "SELECT * FROM test";
    const values = [1, 2, 3];

    if (capturedExecuteSql) {
      await capturedExecuteSql(sql, values);

      expect(pool.query).toHaveBeenCalledWith(sql, values);
    } else {
      fail("executeSql function was not captured");
    }
  });
});
