import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { PostgresLoggerService } from "./postgres-logger.service";

describe(PostgresLoggerService.name, () => {
  it("appends params as a trailing comment when useFormat is false", () => {
    const { service, logger } = setup();

    service.logQuery("SELECT * FROM users WHERE id = $1 AND name = $2", [42, "alice"]);

    expect(logger.debug).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1 AND name = $2 -- params: 42, "alice"');
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

  it("does not throw on params with circular references", () => {
    const { service, logger } = setup({ useFormat: true });
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => service.logQuery("SELECT $1", [circular])).not.toThrow();
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });

  it("falls back to the raw query with params comment when sql-formatter throws", () => {
    const { service, logger } = setup({ useFormat: true });

    service.logQuery("SELECT FROM ((( malformed", [42]);

    expect(logger.debug).toHaveBeenCalledWith("SELECT FROM ((( malformed -- params: 42");
  });

  it("logs 'null' for non-JSON stringifiable params", () => {
    const { service, logger } = setup();

    service.logQuery("SELECT $1", [Symbol("sym"), undefined, () => {}]);

    expect(logger.debug).toHaveBeenCalledWith("SELECT $1 -- params: null, null, null");
  });

  function setup(options?: ConstructorParameters<typeof PostgresLoggerService>[1]) {
    const logger = mock<LoggerService>();
    const service = new PostgresLoggerService(() => logger, options);
    return { service, logger };
  }
});
