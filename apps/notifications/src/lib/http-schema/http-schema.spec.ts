import { describe, expect, it } from "vitest";

import { paginationQuerySchema, toPaginatedQuery } from "./http-schema";

describe("paginationQuerySchema", () => {
  it("coerces page and limit from query strings", () => {
    expect(paginationQuerySchema.parse({ page: "2", limit: "1000" })).toEqual({ page: 2, limit: 1000 });
  });

  it("leaves omitted page and limit undefined", () => {
    expect(paginationQuerySchema.parse({})).toEqual({});
  });

  it.each(["0", "-1", "1.5", "Infinity", "9007199254740992", "abc"])("rejects page %s", page => {
    expect(paginationQuerySchema.safeParse({ page }).success).toBe(false);
  });

  it.each(["0", "-1", "1.5", "1001", "abc"])("rejects limit %s", limit => {
    expect(paginationQuerySchema.safeParse({ limit }).success).toBe(false);
  });

  it("applies the same bounds when combined with route filters", () => {
    const schema = toPaginatedQuery({});

    expect(schema.safeParse({ limit: "-1" }).success).toBe(false);
    expect(schema.parse({ page: "1", limit: "10" })).toEqual({ page: 1, limit: 10 });
  });
});
