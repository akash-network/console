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

  describe("when the seal is an empty string", () => {
    it("refuses it in place of a service patch, which every reader would read as no seal at all", () => {
      expect(parse({ web: {} }, { sealedSecrets: "" }).success).toBe(false);
    });

    it("refuses it beside a service patch that would write something", () => {
      expect(parse({ web: { image: "nginx:1.27" } }, { sealedSecrets: "" }).success).toBe(false);
    });
  });

  describe("http options the provider would read as something else", () => {
    it("refuses a zero body size, which the provider reads as a workload carrying no http options at all", () => {
      expect(parseHttpOptions({ maxBodySize: 0 }).success).toBe(false);
    });

    it("refuses a zero body size even beside the options it would take the rest of the block down with", () => {
      expect(parseHttpOptions({ maxBodySize: 0, readTimeout: 5000, nextTries: 1 }).success).toBe(false);
    });

    it("accepts the smallest body size the provider reads as a body size", () => {
      expect(parseHttpOptions({ maxBodySize: 1 }).success).toBe(true);
    });

    it("accepts the largest body size the grammar allows", () => {
      expect(parseHttpOptions({ maxBodySize: 104857600 }).success).toBe(true);
    });

    it("refuses a body size above what the grammar allows", () => {
      expect(parseHttpOptions({ maxBodySize: 104857601 }).success).toBe(false);
    });

    it("refuses a zero read timeout, which means nginx's own default on one provider and none at all on another", () => {
      expect(parseHttpOptions({ readTimeout: 0 }).success).toBe(false);
    });

    it("refuses a zero send timeout for the same reason", () => {
      expect(parseHttpOptions({ sendTimeout: 0 }).success).toBe(false);
    });

    it("accepts timeouts a provider reads the same way whichever proxy it runs", () => {
      expect(parseHttpOptions({ readTimeout: 5000, sendTimeout: 5000 }).success).toBe(true);
    });

    it("accepts a zero retry count and retry timeout, which every provider reads as unlimited", () => {
      expect(parseHttpOptions({ nextTries: 0, nextTimeout: 0 }).success).toBe(true);
    });

    it("refuses a value above what the manifest can carry", () => {
      expect(parseHttpOptions({ readTimeout: 4294967296 }).success).toBe(false);
    });
  });

  describe("the cases a proxy retries on", () => {
    it("accepts the cases the grammar names", () => {
      expect(parseHttpOptions({ nextCases: ["error", "timeout", "503"] }).success).toBe(true);
    });

    it("refuses a case the grammar does not name", () => {
      expect(parseHttpOptions({ nextCases: ["http_503"] }).success).toBe(false);
    });

    it("refuses an empty list, which would leave the provider rendering a retry rule naming nothing", () => {
      expect(parseHttpOptions({ nextCases: [] }).success).toBe(false);
    });

    it("accepts retrying turned off", () => {
      expect(parseHttpOptions({ nextCases: ["off"] }).success).toBe(true);
    });

    it("refuses retrying turned off beside a case to retry on", () => {
      expect(parseHttpOptions({ nextCases: ["off", "error"] }).success).toBe(false);
    });
  });

  const SEAL = "eyJhbGciOiJSU0EtT0FFUC0yNTYifQ.sealed.payload";

  function parse(services: Record<string, unknown>, rest: Record<string, unknown> = {}) {
    return PatchDeploymentRequestSchema.safeParse({ data: { services, ...rest } });
  }

  function parseHttpOptions(httpOptions: Record<string, unknown>) {
    return parse({ web: { expose: { "80": { httpOptions } } } });
  }
});
