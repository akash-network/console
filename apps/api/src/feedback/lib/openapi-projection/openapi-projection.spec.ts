import type { SchemaObject } from "openapi3-ts/oas30";
import { describe, expect, it } from "vitest";

import { projectedToSchema } from "./openapi-projection";

const API_KEY_SCHEMA: SchemaObject = {
  type: "object",
  properties: { id: { type: "string" }, name: { type: "string" }, keyFormat: { type: "string" } }
};

describe(projectedToSchema.name, () => {
  it("keeps only the properties the schema declares, through refs, arrays and nested objects", () => {
    const schema: SchemaObject = { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/ApiKey" } } } };

    const projected = projectedToSchema({ data: [{ id: "1", name: "ci", keyFormat: "ac.sk.***", hashedKey: "abc", userId: "u1" }], extra: true }, schema, {
      ApiKey: API_KEY_SCHEMA
    });

    expect(projected).toEqual({ data: [{ id: "1", name: "ci", keyFormat: "ac.sk.***" }] });
  });

  it("admits the properties of every allOf, anyOf and oneOf branch", () => {
    const schema: SchemaObject = {
      allOf: [{ type: "object", properties: { id: { type: "string" } } }, { $ref: "#/components/schemas/Named" }],
      oneOf: [{ type: "object", properties: { trial: { type: "boolean" } } }],
      anyOf: [{ type: "object", properties: { tags: { type: "array", items: { type: "string" } } } }]
    };

    expect(
      projectedToSchema({ id: "1", name: "web", trial: true, tags: ["a"], lastIp: "10.0.0.1" }, schema, {
        Named: { type: "object", properties: { name: { type: "string" } } }
      })
    ).toEqual({ id: "1", name: "web", trial: true, tags: ["a"] });
  });

  it("keeps additional properties a record schema allows, projected to its value schema", () => {
    const schema: SchemaObject = { type: "object", additionalProperties: { type: "object", properties: { name: { type: "string" } } } };

    expect(projectedToSchema({ "42": { name: "web", secret: "x" } }, schema)).toEqual({ "42": { name: "web" } });
    expect(projectedToSchema({ a: 1, b: { c: 2 } }, { type: "object", properties: { a: { type: "number" } }, additionalProperties: true })).toEqual({
      a: 1,
      b: { c: 2 }
    });
  });

  it("drops undeclared properties when additional properties are forbidden", () => {
    expect(projectedToSchema({ a: 1, b: 2 }, { type: "object", additionalProperties: false })).toEqual({});
  });

  it("keeps a value whose schema declares no shape, or that has no schema at all", () => {
    expect(projectedToSchema({ a: 1 }, { type: "object" })).toEqual({ a: 1 });
    expect(projectedToSchema({ a: 1 }, {})).toEqual({ a: 1 });
    expect(projectedToSchema({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(projectedToSchema([1, 2], { type: "array" })).toEqual([1, 2]);
    expect(projectedToSchema("text", { type: "string" })).toBe("text");
  });

  it("reads nothing through a ref it cannot resolve", () => {
    expect(projectedToSchema({ a: 1 }, { $ref: "#/components/schemas/Missing" })).toBeNull();
    expect(projectedToSchema({ a: 1 }, { $ref: "https://example.com/schema.json" }, { "https://example.com/schema.json": {} })).toBeNull();
  });

  it("stops at a ref cycle instead of recursing forever", () => {
    const schemas = { Loop: { $ref: "#/components/schemas/Loop" } };

    expect(projectedToSchema({ a: 1 }, { $ref: "#/components/schemas/Loop" }, schemas)).toBeNull();
  });

  it("stops projecting values nested deeper than any published schema", () => {
    const schemas: Record<string, SchemaObject> = {
      Node: { type: "object", properties: { child: { $ref: "#/components/schemas/Node" }, name: { type: "string" } } }
    };
    const nested = Array.from({ length: 40 }).reduce<Record<string, unknown>>(child => ({ name: "n", child }), { name: "leaf" });

    const projected = JSON.stringify(projectedToSchema(nested, { $ref: "#/components/schemas/Node" }, schemas));

    expect(projected).toContain('"child":null');
    expect(projected).not.toContain("leaf");
  });
});
