import postgres from "postgres";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PG_CLIENT } from "./postgres.provider";

vi.mock("postgres", () => ({
  default: Object.assign(vi.fn(() => ({})), { BigInt: {} })
}));

describe("postgres provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates the client with server-side statement, lock, and idle-in-transaction timeouts", () => {
    stubRequiredEnv();
    vi.stubEnv("POSTGRES_STATEMENT_TIMEOUT", "12345");
    vi.stubEnv("POSTGRES_LOCK_TIMEOUT", "6789");
    vi.stubEnv("POSTGRES_IDLE_IN_TRANSACTION_SESSION_TIMEOUT", "4242");

    resolveClient();

    expect(postgres).toHaveBeenCalledWith(
      "postgres://postgres:postgres@localhost:5432/provider_inventory",
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
    stubRequiredEnv();
    vi.stubEnv("POSTGRES_STATEMENT_TIMEOUT", undefined);
    vi.stubEnv("POSTGRES_LOCK_TIMEOUT", undefined);
    vi.stubEnv("POSTGRES_IDLE_IN_TRANSACTION_SESSION_TIMEOUT", undefined);

    resolveClient();

    expect(postgres).toHaveBeenCalledWith(
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

  function resolveClient() {
    const child = container.createChildContainer();
    return child.resolve(PG_CLIENT);
  }

  function stubRequiredEnv() {
    vi.stubEnv("PROVIDER_INVENTORY_POSTGRES_URL", "postgres://postgres:postgres@localhost:5432/provider_inventory");
    vi.stubEnv("REST_API_NODE_URL", "https://api.example.com");
  }
});
