import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PG_CLIENT } from "./postgres.provider";

describe("postgres provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends the configured statement, lock, and idle-in-transaction bounds as startup parameters", () => {
    const client = setup({ statementTimeout: "12345", lockTimeout: "6789", idleInTransactionTimeout: "4242" });

    expect(client.options.connection).toMatchObject({
      statement_timeout: 12345,
      lock_timeout: 6789,
      idle_in_transaction_session_timeout: 4242
    });
  });

  it("bounds every statement with finite defaults when no timeout is configured", () => {
    const client = setup({});

    expect(client.options.connection).toMatchObject({
      statement_timeout: 60_000,
      lock_timeout: 10_000,
      idle_in_transaction_session_timeout: 60_000
    });
  });

  it("falls back to the defaults for blank and whitespace-only values", () => {
    const client = setup({ statementTimeout: "", lockTimeout: "   ", idleInTransactionTimeout: " " });

    expect(client.options.connection).toMatchObject({
      statement_timeout: 60_000,
      lock_timeout: 10_000,
      idle_in_transaction_session_timeout: 60_000
    });
  });

  it("refuses a zero timeout, which postgres.js would drop from the startup message", () => {
    expect(() => setup({ statementTimeout: "0" })).toThrow(/POSTGRES_STATEMENT_TIMEOUT/);
  });

  function setup(input: { statementTimeout?: string; lockTimeout?: string; idleInTransactionTimeout?: string }) {
    vi.stubEnv("PROVIDER_INVENTORY_POSTGRES_URL", "postgres://postgres@localhost:5432/provider_inventory");
    vi.stubEnv("REST_API_NODE_URL", "https://api.example.com");
    vi.stubEnv("POSTGRES_STATEMENT_TIMEOUT", input.statementTimeout);
    vi.stubEnv("POSTGRES_LOCK_TIMEOUT", input.lockTimeout);
    vi.stubEnv("POSTGRES_IDLE_IN_TRANSACTION_SESSION_TIMEOUT", input.idleInTransactionTimeout);

    return container.createChildContainer().resolve(PG_CLIENT);
  }
});
