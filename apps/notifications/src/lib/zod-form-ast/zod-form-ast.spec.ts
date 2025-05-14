import { z } from "zod";

import { toAST } from "./zod-form-ast";

describe("toAST", () => {
  it("should handle string", () => {
    const schema = z.string();
    expect(toAST(schema)).toEqual({ type: "string", label: undefined });
  });

  it("should handle number with default", () => {
    const schema = z.number().default(42);
    expect(toAST(schema)).toEqual({
      type: "number",
      default: 42,
      label: undefined
    });
  });

  it("should handle optional boolean", () => {
    const schema = z.boolean().optional();
    expect(toAST(schema)).toEqual({
      type: "boolean",
      optional: true,
      label: undefined
    });
  });

  it("should handle literal", () => {
    const schema = z.literal("foo");
    expect(toAST(schema)).toEqual({
      type: "select",
      options: ["foo"],
      label: undefined
    });
  });

  it("should handle union of literals as select", () => {
    const schema = z.union([z.literal("a"), z.literal("b")]);
    expect(toAST(schema)).toEqual({
      type: "select",
      options: ["a", "b"],
      label: undefined
    });
  });

  it("should handle array of strings", () => {
    const schema = z.array(z.string());
    expect(toAST(schema)).toEqual({
      type: "array",
      items: { type: "string", label: undefined },
      label: undefined
    });
  });

  it("should handle object", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional()
    });

    expect(toAST(schema)).toEqual({
      type: "object",
      fields: {
        name: { type: "string", label: undefined },
        age: { type: "number", optional: true, label: undefined }
      },
      label: undefined
    });
  });

  it("should handle discriminatedUnion with literal values", () => {
    const schema = z.discriminatedUnion("type", [
      z.object({
        type: z.literal("foo"),
        value: z.string()
      }),
      z.object({
        type: z.literal("bar"),
        count: z.number()
      })
    ]);

    expect(toAST(schema)).toEqual({
      type: "discriminatedUnion",
      discriminator: "type",
      select: {
        type: "select",
        discriminator: true,
        options: ["foo", "bar"]
      },
      mapping: {
        foo: {
          type: "object",
          fields: {
            type: { type: "select", options: ["foo"], label: undefined },
            value: { type: "string", label: undefined }
          },
          label: undefined
        },
        bar: {
          type: "object",
          fields: {
            type: { type: "select", options: ["bar"], label: undefined },
            count: { type: "number", label: undefined }
          },
          label: undefined
        }
      },
      label: undefined
    });
  });

  it("should merge intersection of object + discriminatedUnion as form", () => {
    const base = z.object({
      name: z.string(),
      enabled: z.boolean().optional()
    });

    const schema = z.intersection(
      base,
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("x"),
          data: z.number()
        }),
        z.object({
          type: z.literal("y"),
          flag: z.boolean()
        })
      ])
    );

    expect(toAST(schema)).toEqual({
      type: "form",
      fields: {
        name: { type: "string", label: undefined },
        enabled: { type: "boolean", optional: true, label: undefined }
      },
      discriminator: {
        type: "discriminatedUnion",
        discriminator: "type",
        select: {
          type: "select",
          discriminator: true,
          options: ["x", "y"]
        },
        mapping: {
          x: {
            type: "object",
            fields: {
              type: { type: "select", options: ["x"], label: undefined },
              data: { type: "number", label: undefined }
            },
            label: undefined
          },
          y: {
            type: "object",
            fields: {
              type: { type: "select", options: ["y"], label: undefined },
              flag: { type: "boolean", label: undefined }
            },
            label: undefined
          }
        },
        label: undefined
      }
    });
  });
});
