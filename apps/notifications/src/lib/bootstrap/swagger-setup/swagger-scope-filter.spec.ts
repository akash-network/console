import type { OpenAPIObject } from "@nestjs/swagger";
import { describe, expect, it } from "vitest";

import { filterDocumentByScope } from "./swagger-scope-filter";

describe("filterDocumentByScope", () => {
  it("keeps only non-internal paths in the public scope", () => {
    const document = setup({
      paths: {
        "/v1/things": pathItem(),
        "/internal/users/{userId}/purge": pathItem()
      }
    });

    const filtered = filterDocumentByScope(document, "public");

    expect(Object.keys(filtered.paths)).toEqual(["/v1/things"]);
  });

  it("keeps only internal paths in the internal scope", () => {
    const document = setup({
      paths: {
        "/v1/things": pathItem(),
        "/internal/users/{userId}/purge": pathItem()
      }
    });

    const filtered = filterDocumentByScope(document, "internal");

    expect(Object.keys(filtered.paths)).toEqual(["/internal/users/{userId}/purge"]);
  });

  it("drops schemas not referenced by any kept path", () => {
    const document = setup({
      paths: {
        "/v1/things": pathItem({ refs: ["Thing"] })
      },
      schemas: {
        Thing: schemaObject(),
        UnusedThing: schemaObject()
      }
    });

    const filtered = filterDocumentByScope(document, "public");

    expect(Object.keys(filtered.components?.schemas ?? {})).toEqual(["Thing"]);
  });

  it("follows transitive schema references", () => {
    const document = setup({
      paths: {
        "/v1/things": pathItem({ refs: ["Outer"] })
      },
      schemas: {
        Outer: schemaObject({ refs: ["Inner"] }),
        Inner: schemaObject({ refs: ["Leaf"] }),
        Leaf: schemaObject(),
        Unrelated: schemaObject()
      }
    });

    const filtered = filterDocumentByScope(document, "public");

    expect(Object.keys(filtered.components?.schemas ?? {}).sort()).toEqual(["Inner", "Leaf", "Outer"]);
  });

  it("returns empty schemas when filtered paths reference nothing", () => {
    const document = setup({
      paths: {
        "/internal/users/{userId}/purge": pathItem()
      },
      schemas: {
        SomePublicSchema: schemaObject()
      }
    });

    const filtered = filterDocumentByScope(document, "internal");

    expect(filtered.components?.schemas).toEqual({});
  });

  it("does not bleed schemas from dropped paths into the kept scope", () => {
    const document = setup({
      paths: {
        "/v1/public": pathItem({ refs: ["PublicOnly"] }),
        "/internal/private": pathItem({ refs: ["InternalOnly"] })
      },
      schemas: {
        PublicOnly: schemaObject(),
        InternalOnly: schemaObject()
      }
    });

    const publicDoc = filterDocumentByScope(document, "public");
    const internalDoc = filterDocumentByScope(document, "internal");

    expect(Object.keys(publicDoc.components?.schemas ?? {})).toEqual(["PublicOnly"]);
    expect(Object.keys(internalDoc.components?.schemas ?? {})).toEqual(["InternalOnly"]);
  });

  it("treats an exact /internal path as internal (no trailing slash required)", () => {
    const document = setup({
      paths: {
        "/internal": pathItem(),
        "/internal/users/{userId}/purge": pathItem(),
        "/internalfoo": pathItem()
      }
    });

    const internalDoc = filterDocumentByScope(document, "internal");
    const publicDoc = filterDocumentByScope(document, "public");

    expect(Object.keys(internalDoc.paths).sort()).toEqual(["/internal", "/internal/users/{userId}/purge"]);
    expect(Object.keys(publicDoc.paths)).toEqual(["/internalfoo"]);
  });

  it("preserves the rest of the document untouched", () => {
    const document = setup({
      paths: { "/v1/things": pathItem() },
      info: { title: "Custom Title", version: "9.9.9" }
    });

    const filtered = filterDocumentByScope(document, "public");

    expect(filtered.info).toEqual({ title: "Custom Title", version: "9.9.9" });
    expect(filtered.openapi).toBe(document.openapi);
  });

  function setup(input: { paths: OpenAPIObject["paths"]; schemas?: Record<string, unknown>; info?: OpenAPIObject["info"] }): OpenAPIObject {
    return {
      openapi: "3.0.0",
      info: input.info ?? { title: "Test", version: "1.0" },
      paths: input.paths,
      components: { schemas: (input.schemas as OpenAPIObject["components"] extends infer C ? (C extends { schemas?: infer S } ? S : never) : never) ?? {} }
    };
  }
});

function pathItem(input: { refs?: string[] } = {}): Record<string, unknown> {
  return {
    get: {
      responses: {
        "200": {
          description: "ok",
          content: {
            "application/json": {
              schema: input.refs?.length ? { $ref: `#/components/schemas/${input.refs[0]}` } : { type: "object" }
            }
          }
        }
      }
    }
  };
}

function schemaObject(input: { refs?: string[] } = {}): Record<string, unknown> {
  if (!input.refs?.length) {
    return { type: "object", properties: { id: { type: "string" } } };
  }
  return {
    type: "object",
    properties: Object.fromEntries(input.refs.map((name, idx) => [`field${idx}`, { $ref: `#/components/schemas/${name}` }]))
  };
}
