import { describe, expect, it } from "vitest";

import { parseJsonb, serializeJsonb } from "./jsonb-bigint";

describe("serializeJsonb", () => {
  it("serializes bigint values as raw JSON numbers", () => {
    const result = serializeJsonb({ cpu: 4000n, name: "node-1" });

    expect(result).toBe('{"cpu":4000,"name":"node-1"}');
  });

  it("preserves precision for values exceeding Number.MAX_SAFE_INTEGER", () => {
    const big = 9007199254740993n;
    const result = serializeJsonb({ value: big });

    expect(result).toBe('{"value":9007199254740993}');
    expect(result).not.toContain('"9007199254740993"');
  });

  it("handles negative bigints", () => {
    const result = serializeJsonb({ value: -42n });

    expect(result).toBe('{"value":-42}');
  });

  it("handles nested objects with mixed types", () => {
    const result = serializeJsonb({
      nodes: [{ cpu: { available: 8000n }, name: "n1" }],
      count: 1
    });

    expect(result).toBe('{"nodes":[{"cpu":{"available":8000},"name":"n1"}],"count":1}');
  });
});

describe("parseJsonb", () => {
  it("keeps safe integers as number", () => {
    const result = parseJsonb('{"cpu": 4000, "name": "node-1"}') as { cpu: number; name: string };

    expect(result.cpu).toBe(4000);
    expect(typeof result.cpu).toBe("number");
    expect(result.name).toBe("node-1");
  });

  it("promotes to bigint only when precision would be lost", () => {
    const result = parseJsonb('{"value": 9007199254740993}') as { value: bigint };

    expect(result.value).toBe(9007199254740993n);
    expect(typeof result.value).toBe("bigint");
  });

  it("preserves floating-point numbers as number", () => {
    const result = parseJsonb('{"rate": 3.14}') as { rate: number };

    expect(result.rate).toBe(3.14);
    expect(typeof result.rate).toBe("number");
  });

  it("handles nested structures", () => {
    const result = parseJsonb('{"nodes": [{"cpu": {"available": 8000}}]}') as {
      nodes: Array<{ cpu: { available: number } }>;
    };

    expect(result.nodes[0].cpu.available).toBe(8000);
    expect(typeof result.nodes[0].cpu.available).toBe("number");
  });
});

describe("round-trip", () => {
  it("preserves unsafe bigint values through serialize then parse", () => {
    const original = { memory: 9007199254740993n };

    const parsed = parseJsonb(serializeJsonb(original)) as typeof original;

    expect(parsed.memory).toBe(9007199254740993n);
  });

  it("keeps safe values as number through serialize then parse", () => {
    const original = { cpu: 4000n, name: "node-1" };

    const parsed = parseJsonb(serializeJsonb(original)) as { cpu: number; name: string };

    expect(parsed.cpu).toBe(4000);
    expect(typeof parsed.cpu).toBe("number");
  });
});
