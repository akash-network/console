import { ConfigService } from "@nestjs/config";
import { mock } from "jest-mock-extended";
import type { Client } from "pg";

import { createPgClientFactory } from "./db.provider";

import { generateBrokerConfig } from "@test/seeders/broker-config.seeder";

describe("createPgClient", () => {
  it("should create a client with the correct connection string", async () => {
    const config = generateBrokerConfig();
    const clientInstance = mock<Client>();
    const MockClient = jest.fn().mockImplementation(() => clientInstance);

    const client = await createPgClientFactory(MockClient as unknown as typeof Client)(new ConfigService(config));

    expect(MockClient).toHaveBeenCalledWith(config["broker.EVENT_BROKER_POSTGRES_URI"]);
    expect(client.connect).toHaveBeenCalled();
  });
});
