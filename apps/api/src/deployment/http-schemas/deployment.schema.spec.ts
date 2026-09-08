import "@hono/zod-openapi";

import { describe, expect, it } from "vitest";

import { PatchDeploymentRequestSchema } from "./deployment.schema";

describe("PatchDeploymentRequestSchema", () => {
  describe("a patch that would write nothing", () => {
    it("refuses a body naming no service", () => {
      expect(parse({}).success).toBe(false);
    });

    it("refuses a service naming no field", () => {
      expect(parse({ web: {} }).success).toBe(false);
    });

    it("refuses an env record carrying no variable", () => {
      expect(parse({ web: { env: {} } }).success).toBe(false);
    });

    it("refuses an expose record carrying no port", () => {
      expect(parse({ web: { expose: {} } }).success).toBe(false);
    });

    it("refuses a storage record carrying no volume", () => {
      expect(parse({ web: { storage: {} } }).success).toBe(false);
    });

    it("refuses every empty record at once rather than passing on the count of them", () => {
      expect(parse({ web: { env: {}, expose: {}, storage: {} } }).success).toBe(false);
    });

    it("refuses a service that assigns nothing next to one that also assigns nothing", () => {
      expect(parse({ web: { env: {} }, worker: {} }).success).toBe(false);
    });
  });

  describe("a patch that would write something", () => {
    it("accepts a service naming no field when the request carries sealed secrets", () => {
      expect(parse({ web: {} }, { sealedSecrets: SEAL }).success).toBe(true);
    });

    it("accepts sealed secrets alongside a service whose every record is empty", () => {
      expect(parse({ web: { env: {} } }, { sealedSecrets: SEAL }).success).toBe(true);
    });

    it("accepts a field alongside an empty record", () => {
      expect(parse({ web: { image: "nginx:1.27", env: {} } }).success).toBe(true);
    });

    it("accepts an empty command list, which clears the one the service declared", () => {
      expect(parse({ web: { command: [] } }).success).toBe(true);
    });

    it("accepts cleared credentials", () => {
      expect(parse({ web: { credentials: null } }).success).toBe(true);
    });

    it("accepts one assigning service beside one that assigns nothing", () => {
      expect(parse({ web: {}, worker: { image: "busybox:1.37" } }).success).toBe(true);
    });

    it("leaves a named port to the writer, which knows whether the document declares it", () => {
      expect(parse({ web: { expose: { "80": { httpOptions: {} } } } }).success).toBe(true);
    });

    it("leaves a named volume to the writer, which knows whether the profile declares it", () => {
      expect(parse({ web: { storage: { data: {} } } }).success).toBe(true);
    });
  });

  const SEAL = "eyJhbGciOiJSU0EtT0FFUC0yNTYifQ.sealed.payload";

  function parse(services: Record<string, unknown>, rest: Record<string, unknown> = {}) {
    return PatchDeploymentRequestSchema.safeParse({ data: { services, ...rest } });
  }
});
