import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { PostgresLoggerService } from "./postgres-logger.service";

describe(PostgresLoggerService.name, () => {
  it("appends params as a trailing comment when useFormat is false", () => {
    const { service, logger } = setup();

    service.logQuery("SELECT * FROM users WHERE id = $1 AND is_active = $2", [42, true]);

    expect(logger.debug).toHaveBeenCalledWith("SELECT * FROM users WHERE id = $1 AND is_active = $2 -- params: 42, true");
  });

  it("substitutes numbered params into the formatted SQL when useFormat is true", () => {
    const { service, logger } = setup({ useFormat: true });

    service.logQuery("SELECT * FROM users WHERE id = $1", [123]);

    expect(logger.debug).toHaveBeenCalledWith("SELECT\n  *\nFROM\n  users\nWHERE\n  id = 123");
  });

  it("stringifies bigint params via toString so they appear in the formatted SQL", () => {
    const { service, logger } = setup({ useFormat: true });

    service.logQuery("SELECT * FROM users WHERE id = $1", [BigInt("9007199254740993")]);

    expect(logger.debug).toHaveBeenCalledWith("SELECT\n  *\nFROM\n  users\nWHERE\n  id = 9007199254740993");
  });

  it("redacts string and object params in the trailing comment when useFormat is false", () => {
    const { service, logger } = setup();

    service.logQuery('INSERT INTO "deployments" ("definition", "sealed_secrets") VALUES ($1, $2)', [{ env: ["API_KEY=plain"] }, "sealed-token"]);

    expect(logger.debug).toHaveBeenCalledWith(
      'INSERT INTO "deployments" ("definition", "sealed_secrets") VALUES ($1, $2) -- params: <redacted object>, <redacted string>'
    );
  });

  it("redacts string and object params in the formatted SQL when useFormat is true", () => {
    const { service, logger } = setup({ useFormat: true });

    service.logQuery('INSERT INTO "deployments" ("definition", "sealed_secrets") VALUES ($1, $2)', [{ env: ["API_KEY=plain"] }, "sealed-token"]);

    expect(logger.debug).toHaveBeenCalledWith(
      'INSERT INTO\n  "deployments" ("definition", "sealed_secrets")\nVALUES\n  (<redacted object>, <redacted string>)'
    );
  });

  it("falls back to the raw query with params comment when sql-formatter throws", () => {
    const { service, logger } = setup({ useFormat: true });

    service.logQuery("SELECT FROM ((( malformed", [42]);

    expect(logger.debug).toHaveBeenCalledWith("SELECT FROM ((( malformed -- params: 42");
  });

  function setup(options?: ConstructorParameters<typeof PostgresLoggerService>[1]) {
    const logger = mock<LoggerService>();
    const service = new PostgresLoggerService(() => logger, options);
    return { service, logger };
  }
});
