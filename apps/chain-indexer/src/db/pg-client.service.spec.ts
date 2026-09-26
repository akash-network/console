import { describe, expect, it } from "vitest";

import { envSchema } from "@src/config/env.config";
import { PgClientService } from "@src/db/pg-client.service";

describe(PgClientService.name, () => {
  it("opens read-only connections with a statement timeout for the api role", () => {
    const { client } = setup({ role: "api" });

    expect(client.options.connection).toEqual(expect.objectContaining({ default_transaction_read_only: true, statement_timeout: 30_000 }));
  });

  it("honours a configured statement timeout for the api role", () => {
    const { client } = setup({ role: "api", statementTimeoutMs: 5_000 });

    expect(client.options.connection).toEqual(expect.objectContaining({ statement_timeout: 5_000 }));
  });

  it("leaves writer roles read-write without a statement timeout", () => {
    const { client } = setup({ role: "sync" });

    expect(client.options.connection.default_transaction_read_only).toBeUndefined();
    expect(client.options.connection.statement_timeout).toBeUndefined();
  });

  function setup(input: { role: "api" | "sync"; statementTimeoutMs?: number }) {
    const config = envSchema.parse({
      POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit",
      INDEXER_ROLE: input.role,
      ...(input.statementTimeoutMs ? { API_STATEMENT_TIMEOUT_MS: String(input.statementTimeoutMs) } : {})
    });
    const service = new PgClientService(config);
    return { client: service.client };
  }
});
