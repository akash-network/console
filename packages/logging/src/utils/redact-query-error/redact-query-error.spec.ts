import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { redactQueryError } from "./redact-query-error";

const INSERT_DEPLOYMENT = 'insert into "deployment_settings" ("dseq", "sdl", "sealed_secrets") values ($1, $2, $3)';
const REDACTED_INSERT_MESSAGE = `Failed query: ${INSERT_DEPLOYMENT}\nparams: 42, <redacted string>, <redacted string>`;

describe(redactQueryError.name, () => {
  it("rebuilds a failed query's message with its params redacted", () => {
    const redacted = redactQueryError(failedInsert()) as DrizzleQueryError;

    expect(redacted.message).toBe(REDACTED_INSERT_MESSAGE);
  });

  it("rebuilds its stack with the params redacted and the frames kept", () => {
    const error = failedInsert();

    const redacted = redactQueryError(error) as DrizzleQueryError;

    expect(redacted.stack).toBe(`Error: ${REDACTED_INSERT_MESSAGE}${error.stack!.slice(error.stack!.indexOf("\n    at "))}`);
  });

  it("keeps the query as a field and leaves the params to its message", () => {
    const redacted = redactQueryError(failedInsert()) as DrizzleQueryError;

    expect(redacted.query).toBe(INSERT_DEPLOYMENT);
    expect(redacted).not.toHaveProperty("params");
  });

  it("returns a copy it already redacted as it is", () => {
    const redacted = redactQueryError(failedInsert());

    expect(redactQueryError(redacted)).toBe(redacted);
  });

  it("keeps only the message, stack and code of the driver error that caused it", () => {
    const driverError = Object.assign(new Error('null value in column "name" violates not-null constraint'), {
      name: "PostgresError",
      code: "23502",
      detail: "Failing row contains (42, version: '2.0', sealed-token)"
    });

    const cause = (redactQueryError(failedInsert(driverError)) as DrizzleQueryError).cause as typeof driverError;

    expect(cause).not.toBe(driverError);
    expect(cause.name).toBe("PostgresError");
    expect(cause.message).toBe('null value in column "name" violates not-null constraint');
    expect(cause.stack).toBe(driverError.stack);
    expect(cause.code).toBe("23502");
    expect(cause).not.toHaveProperty("detail");
  });

  it("gives the driver error no code when it had none", () => {
    const cause = (redactQueryError(failedInsert(new Error("Connection terminated unexpectedly"))) as DrizzleQueryError).cause;

    expect(cause).not.toHaveProperty("code");
  });

  it("gives the rebuilt error no cause when the failed query had none", () => {
    const redacted = redactQueryError(failedInsert()) as DrizzleQueryError;

    expect(redacted.cause).toBeUndefined();
  });

  it("leaves the stack missing when the failed query has none", () => {
    const error = failedInsert();
    error.stack = undefined;

    const redacted = redactQueryError(error) as DrizzleQueryError;

    expect(redacted.stack).toBeUndefined();
  });

  it("returns an error that carries no query as it is", () => {
    const error = Object.assign(new Error("insert failed"), { params: ["sealed-token"] });

    expect(redactQueryError(error)).toBe(error);
  });

  it("returns a value that is not an error as it is", () => {
    expect(redactQueryError("boom")).toBe("boom");
  });

  function failedInsert(cause?: Error) {
    return new DrizzleQueryError(INSERT_DEPLOYMENT, [42, "version: '2.0'\nservices: {}", "sealed-token"], cause);
  }
});
