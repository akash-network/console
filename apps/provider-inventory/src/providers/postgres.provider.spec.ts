import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PG_CLIENT } from "./postgres.provider";

vi.mock("postgres", () => ({
  default: Object.assign(
    vi.fn(() => ({})),
    { BigInt: {} }
  )
}));

describe("postgres provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates the client with server-side statement, lock, and idle-in-transaction timeouts", () => {
    const { expectedUri } = setup({ statementTimeout: "12345", lockTimeout: "6789", idleInTransactionTimeout: "4242" });

    expect(postgres).toHaveBeenLastCalledWith(
      expectedUri,
      expect.objectContaining({
        connection: expect.objectContaining({
          statement_timeout: 12345,
          lock_timeout: 6789,
          idle_in_transaction_session_timeout: 4242
        })
      })
    );
  });

  it("bounds every statement with finite timeout defaults when none are configured", () => {
    setup({});

    expect(postgres).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        connection: expect.objectContaining({
          statement_timeout: 60_000,
          lock_timeout: 10_000,
          idle_in_transaction_session_timeout: 60_000
        })
      })
    );
  });

  it("falls back to the timeout defaults for blank or whitespace-only values instead of disabling the bounds", () => {
    setup({ statementTimeout: "", lockTimeout: "   ", idleInTransactionTimeout: " " });

    expect(postgres).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        connection: expect.objectContaining({
          statement_timeout: 60_000,
          lock_timeout: 10_000,
          idle_in_transaction_session_timeout: 60_000
        })
      })
    );
  });

  it("keeps a literal zero as the explicit opt-out of every bound", () => {
    setup({ statementTimeout: "0", lockTimeout: "0", idleInTransactionTimeout: "0" });

    expect(postgres).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        connection: expect.objectContaining({
          statement_timeout: 0,
          lock_timeout: 0,
          idle_in_transaction_session_timeout: 0
        })
      })
    );
  });

  function setup(input: { statementTimeout?: string; lockTimeout?: string; idleInTransactionTimeout?: string }) {
    const expectedUri = `postgres://postgres:${randomUUID()}@localhost:5432/provider_inventory`;
    vi.stubEnv("PROVIDER_INVENTORY_POSTGRES_URL", expectedUri);
    vi.stubEnv("REST_API_NODE_URL", "https://api.example.com");
    vi.stubEnv("POSTGRES_STATEMENT_TIMEOUT", input.statementTimeout);
    vi.stubEnv("POSTGRES_LOCK_TIMEOUT", input.lockTimeout);
    vi.stubEnv("POSTGRES_IDLE_IN_TRANSACTION_SESSION_TIMEOUT", input.idleInTransactionTimeout);

    const child = container.createChildContainer();
    child.resolve(PG_CLIENT);
    return { expectedUri };
  }
});
