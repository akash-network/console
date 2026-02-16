import { ConfigService } from "@nestjs/config";
import { mock } from "jest-mock-extended";
import type { Pool } from "pg";

import { createPgPoolFactory } from "./db.provider";

import { generateBrokerConfig } from "@test/seeders/broker-config.seeder";

describe("createPgPool", () => {
  it("should create a pool with the correct connection string", async () => {
    const config = generateBrokerConfig();
    const poolInstance = mock<Pool>();
    const MockPool = jest.fn().mockImplementation(() => poolInstance);

    const pool = await createPgPoolFactory(MockPool as unknown as typeof Pool)(new ConfigService(config));

    expect(MockPool).toHaveBeenCalledWith({ connectionString: config["broker.EVENT_BROKER_POSTGRES_URI"] });
    expect(pool).toBe(poolInstance);
  });
});
