import { describe, expect, it } from "vitest";

import { AskedValueSchema, AskedValuesSchema } from "./asked-values.schema";

describe("AskedValuesSchema", () => {
  it("accepts every value type", () => {
    const result = AskedValuesSchema.safeParse([
      askedValue({ type: "text", key: "NAME", default: "x", minLength: 1, maxLength: 5 }),
      askedValue({ type: "number", key: "PORT", default: "80", min: 1, max: 100, integer: true }),
      askedValue({ type: "boolean", key: "DEBUG", default: "false" }),
      askedValue({ type: "choice", key: "MODE", choices: ["a", "b"], default: "a" }),
      askedValue({ type: "secret", key: "TOKEN" })
    ]);

    expect(result.success).toBe(true);
  });

  it("refuses a default on a secret", () => {
    expect(AskedValueSchema.safeParse(askedValue({ type: "secret", default: "hunter2" })).success).toBe(false);
  });

  it("refuses a key that is not an environment variable name", () => {
    expect(AskedValueSchema.safeParse(askedValue({ key: "1ST" })).success).toBe(false);
    expect(AskedValueSchema.safeParse(askedValue({ key: "has space" })).success).toBe(false);
    expect(AskedValueSchema.safeParse(askedValue({ key: "" })).success).toBe(false);
    expect(AskedValueSchema.safeParse(askedValue({ key: ".x" })).success).toBe(false);
    expect(AskedValueSchema.safeParse(askedValue({ key: "a-b" })).success).toBe(false);
    expect(AskedValueSchema.safeParse(askedValue({ key: "-._ok.1" })).success).toBe(false);
    expect(AskedValueSchema.safeParse(askedValue({ key: "_ok_1" })).success).toBe(true);
  });

  it("limits a key to 64 characters", () => {
    expect(AskedValueSchema.safeParse(askedValue({ key: "A".repeat(64) })).success).toBe(true);
    expect(AskedValueSchema.safeParse(askedValue({ key: "A".repeat(65) })).success).toBe(false);
  });

  it("accepts a binding env with dots and dashes", () => {
    expect(AskedValueSchema.safeParse(askedValue({ bindings: [{ service: "web", env: "-._ok.1" }] })).success).toBe(true);
  });

  it("limits a binding's service to 63 characters and its env to 255", () => {
    const parses = (binding: { service: string; env: string }) => AskedValueSchema.safeParse(askedValue({ bindings: [binding] })).success;

    expect(parses({ service: "w".repeat(63), env: "E".repeat(255) })).toBe(true);
    expect(parses({ service: "w".repeat(64), env: "NAME" })).toBe(false);
    expect(parses({ service: "web", env: "E".repeat(256) })).toBe(false);
  });

  it("refuses a number limit that is not finite", () => {
    expect(AskedValueSchema.safeParse(askedValue({ type: "number", min: Infinity })).success).toBe(false);
    expect(AskedValueSchema.safeParse(askedValue({ type: "number", max: -Infinity })).success).toBe(false);
    expect(AskedValueSchema.safeParse(askedValue({ type: "number", min: 1, max: 2 })).success).toBe(true);
  });

  it("refuses a binding whose env is not an environment variable name", () => {
    expect(AskedValueSchema.safeParse(askedValue({ bindings: [{ service: "web", env: "9LIVES" }] })).success).toBe(false);
  });

  it("refuses more than 50 values", () => {
    const values = (count: number) => Array.from({ length: count }, (_, index) => askedValue({ key: `KEY_${index}` }));

    expect(AskedValuesSchema.safeParse(values(50)).success).toBe(true);
    expect(AskedValuesSchema.safeParse(values(51)).success).toBe(false);
  });

  it("refuses a choice with no choices", () => {
    expect(AskedValueSchema.safeParse(askedValue({ type: "choice", choices: [] })).success).toBe(false);
  });

  it("limits how many choices a value offers and how long each is", () => {
    const choices = (count: number) => Array.from({ length: count }, (_, index) => `c${index}`);

    expect(AskedValueSchema.safeParse(askedValue({ type: "choice", choices: choices(50) })).success).toBe(true);
    expect(AskedValueSchema.safeParse(askedValue({ type: "choice", choices: choices(51) })).success).toBe(false);
    expect(AskedValueSchema.safeParse(askedValue({ type: "choice", choices: ["a".repeat(200)] })).success).toBe(true);
    expect(AskedValueSchema.safeParse(askedValue({ type: "choice", choices: ["a".repeat(201)] })).success).toBe(false);
  });

  it("limits the label, help text and default", () => {
    expect(AskedValueSchema.safeParse(askedValue({ label: "" })).success).toBe(false);
    expect(AskedValueSchema.safeParse(askedValue({ label: "a".repeat(80) })).success).toBe(true);
    expect(AskedValueSchema.safeParse(askedValue({ label: "a".repeat(81) })).success).toBe(false);
    expect(AskedValueSchema.safeParse(askedValue({ help: "a".repeat(500) })).success).toBe(true);
    expect(AskedValueSchema.safeParse(askedValue({ help: "a".repeat(501) })).success).toBe(false);
    expect(AskedValueSchema.safeParse(askedValue({ default: "a".repeat(4096) })).success).toBe(true);
    expect(AskedValueSchema.safeParse(askedValue({ default: "a".repeat(4097) })).success).toBe(false);
  });

  it("requires between 1 and 20 bindings", () => {
    const bindings = (count: number) => Array.from({ length: count }, (_, index) => ({ service: "web", env: `ENV_${index}` }));

    expect(AskedValueSchema.safeParse(askedValue({ bindings: [] })).success).toBe(false);
    expect(AskedValueSchema.safeParse(askedValue({ bindings: bindings(20) })).success).toBe(true);
    expect(AskedValueSchema.safeParse(askedValue({ bindings: bindings(21) })).success).toBe(false);
  });

  it("refuses a boolean default other than true or false", () => {
    expect(AskedValueSchema.safeParse(askedValue({ type: "boolean", default: "yes" })).success).toBe(false);
  });

  it("refuses an unknown type", () => {
    expect(AskedValueSchema.safeParse(askedValue({ type: "date" })).success).toBe(false);
  });

  it("refuses fields that belong to another type", () => {
    expect(AskedValueSchema.safeParse(askedValue({ type: "text", min: 1 })).success).toBe(false);
  });

  function askedValue(overrides: Record<string, unknown> = {}) {
    return {
      type: "text",
      key: "NAME",
      label: "Name",
      required: true,
      bindings: [{ service: "web", env: "NAME" }],
      ...overrides
    };
  }
});
