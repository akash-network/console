import "@hono/zod-openapi";

import { describe, expect, it } from "vitest";

import { PatchServiceSchema } from "./deployment.schema";

describe("PatchServiceSchema", () => {
  describe("a patch that would write nothing", () => {
    it("refuses a patch naming no field at all", () => {
      expect(PatchServiceSchema.safeParse({}).success).toBe(false);
    });

    it("refuses an env record carrying no variable", () => {
      expect(PatchServiceSchema.safeParse({ env: {} }).success).toBe(false);
    });

    it("refuses an expose record carrying no port", () => {
      expect(PatchServiceSchema.safeParse({ expose: {} }).success).toBe(false);
    });

    it("refuses a storage record carrying no volume", () => {
      expect(PatchServiceSchema.safeParse({ storage: {} }).success).toBe(false);
    });

    it("refuses every empty record at once rather than passing on the count of them", () => {
      expect(PatchServiceSchema.safeParse({ env: {}, expose: {}, storage: {} }).success).toBe(false);
    });
  });

  describe("a patch that would write something", () => {
    it("accepts a field alongside an empty record", () => {
      expect(PatchServiceSchema.safeParse({ image: "nginx:1.27", env: {} }).success).toBe(true);
    });

    it("accepts an empty command list, which clears the one the service declared", () => {
      expect(PatchServiceSchema.safeParse({ command: [] }).success).toBe(true);
    });

    it("accepts cleared credentials", () => {
      expect(PatchServiceSchema.safeParse({ credentials: null }).success).toBe(true);
    });

    it("leaves a named port to the writer, which knows whether the document declares it", () => {
      expect(PatchServiceSchema.safeParse({ expose: { "80": { httpOptions: {} } } }).success).toBe(true);
    });

    it("leaves a named volume to the writer, which knows whether the profile declares it", () => {
      expect(PatchServiceSchema.safeParse({ storage: { data: {} } }).success).toBe(true);
    });
  });
});
