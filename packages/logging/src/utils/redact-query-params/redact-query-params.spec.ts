import { describe, expect, it } from "vitest";

import { redactQueryParams } from "./redact-query-params";

describe(redactQueryParams.name, () => {
  it("keeps numbers, bigints and booleans verbatim", () => {
    expect(redactQueryParams([42, 1.5, BigInt("9007199254740993"), true, false])).toEqual(["42", "1.5", "9007199254740993", "true", "false"]);
  });

  it("keeps null and undefined verbatim", () => {
    expect(redactQueryParams([null, undefined])).toEqual(["null", "undefined"]);
  });

  it("redacts strings", () => {
    expect(redactQueryParams(["sealed-secrets-token"])).toEqual(["<redacted string>"]);
  });

  it("redacts objects, arrays and binary values", () => {
    expect(redactQueryParams([{ env: ["API_KEY=secret"] }, ["secret"], Buffer.from("wrapped-data-key")])).toEqual([
      "<redacted object>",
      "<redacted object>",
      "<redacted object>"
    ]);
  });

  it("redacts symbols and functions", () => {
    expect(redactQueryParams([Symbol("secret"), () => "secret"])).toEqual(["<redacted symbol>", "<redacted function>"]);
  });
});
