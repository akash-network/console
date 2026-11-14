import "@hono/zod-openapi";

import { describe, expect, it } from "vitest";

import { MAX_SUBMITTED_SDL_LENGTH } from "@src/deployment/config/sdl.config";
import {
  CreateDeploymentDefinitionRequestSchema,
  CreateDeploymentRequestSchema,
  ListDeploymentsQuerySchema,
  ListWithResourcesParamsSchema,
  PatchDeploymentRequestSchema,
  UpdateDeploymentRequestSchema
} from "./deployment.schema";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe("UpdateDeploymentRequestSchema", () => {
  it("accepts an sdl up to the largest submittable length", () => {
    expect(UpdateDeploymentRequestSchema.safeParse({ data: { sdl: "d".repeat(MAX_SUBMITTED_SDL_LENGTH) } }).success).toBe(true);
  });

  it("refuses an sdl longer than the largest submittable length", () => {
    const result = UpdateDeploymentRequestSchema.safeParse({ data: { sdl: "d".repeat(MAX_SUBMITTED_SDL_LENGTH + 1) } });

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(expect.objectContaining({ code: "too_big", path: ["data", "sdl"] }));
  });
});

describe("CreateDeploymentRequestSchema", () => {
  describe("the variables secretEnv names", () => {
    it("keeps the names it was given", () => {
      expect(parse({ secretEnv: ["API_KEY", "my.var"] }).data?.data.secretEnv).toEqual(["API_KEY", "my.var"]);
    });

    it("keeps an empty list apart from a request that carries none", () => {
      expect(parse({ secretEnv: [] }).data?.data.secretEnv).toEqual([]);
      expect(parse({}).data?.data.secretEnv).toBeUndefined();
    });

    it.each(["A=B", "MY VAR", "1VAR", ""])("refuses %j, which no env variable is named", name => {
      expect(parse({ secretEnv: [name] }).success).toBe(false);
    });
  });

  describe("what the request says to deploy", () => {
    const service = { image: "nginx:1.27.2", resources: { cpu: 0.5, memory: "512Mi", storage: "1Gi" }, ports: [{ port: 80 }] };
    const overrides = { web: { env: { LOG_LEVEL: "debug" } } };

    it("accepts an sdl, with or without the template it came from", () => {
      expect(parse({}).success).toBe(true);
      expect(parse({ templateId: "nginx" }).success).toBe(true);
    });

    it("accepts a service in place of an sdl", () => {
      expect(parse({ sdl: undefined, service }).data?.data.service).toEqual(service);
    });

    it("accepts a template on its own, with or without overrides", () => {
      expect(parse({ sdl: undefined, templateId: "nginx" }).success).toBe(true);
      expect(parse({ sdl: undefined, templateId: "nginx", overrides }).data?.data.overrides).toEqual(overrides);
    });

    it.each([
      ["nothing to deploy", { sdl: undefined }, "Send one of sdl, service or templateId"],
      ["only a template version", { sdl: undefined, templateVersionId: "0f2d8a52-62f2-4c8f-8f0b-3f1f0c9d2a11" }, "Send one of sdl, service or templateId"],
      ["an sdl beside a service", { service }, "Send either sdl or service, not both"],
      ["an empty sdl beside a service", { sdl: "", service }, "Send either sdl or service, not both"],
      ["a service beside a template", { sdl: undefined, service, templateId: "nginx" }, "service cannot be combined with templateId or templateVersionId"],
      [
        "a service beside a template version",
        { sdl: undefined, service, templateVersionId: "0f2d8a52-62f2-4c8f-8f0b-3f1f0c9d2a11" },
        "service cannot be combined with templateId or templateVersionId"
      ],
      ["overrides beside an sdl", { templateId: "nginx", overrides }, "overrides apply only to a deployment created from templateId without sdl"],
      ["overrides without a template", { sdl: undefined, overrides }, "overrides apply only to a deployment created from templateId without sdl"]
    ])("refuses %s", (_, rest, message) => {
      const result = parse(rest);

      expect(result.success).toBe(false);
      expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(expect.objectContaining({ code: "custom", message, path: ["data"] }));
    });

    it.each(["512", "512MB", "half", "1.5 Gi", ""])("refuses %j as a memory size", memory => {
      expect(parse({ sdl: undefined, service: { ...service, resources: { ...service.resources, memory } } }).success).toBe(false);
    });

    it.each(["256Mi", "1.5Gi", "500M", "2T"])("accepts %j as a storage size", storage => {
      expect(parse({ sdl: undefined, service: { ...service, resources: { ...service.resources, storage } } }).success).toBe(true);
    });

    it("refuses a service that publishes no port", () => {
      expect(parse({ sdl: undefined, service: { ...service, ports: [] } }).success).toBe(false);
    });

    it.each([
      [
        "a container port listed twice",
        [
          { port: 8080, as: 80 },
          { port: 8080, as: 8081 }
        ]
      ],
      ["two ports reached on the same port", [{ port: 3000, as: 80 }, { port: 80 }]]
    ])("refuses %s", (_, ports) => {
      expect(parse({ sdl: undefined, service: { ...service, ports } }).success).toBe(false);
    });

    it("accepts ports that differ in both the port they listen on and the port they are reached on", () => {
      expect(parse({ sdl: undefined, service: { ...service, ports: [{ port: 3000, as: 80 }, { port: 9090 }] } }).success).toBe(true);
    });

    it.each([
      ["no gpu at all", { units: 0 }],
      ["a fraction of a gpu", { units: 0.5 }],
      ["an empty model", { units: 1, model: "" }]
    ])("refuses a gpu request for %s", (_, gpu) => {
      expect(parse({ sdl: undefined, service: { ...service, resources: { ...service.resources, gpu } } }).success).toBe(false);
    });

    it("refuses an env variable no container could be given", () => {
      expect(parse({ sdl: undefined, service: { ...service, env: { "MY VAR": "x" } } }).success).toBe(false);
    });
  });

  function parse(rest: Record<string, unknown>) {
    return CreateDeploymentRequestSchema.safeParse({ data: { sdl: "version: '2.0'", ...rest } });
  }
});

describe("CreateDeploymentDefinitionRequestSchema", () => {
  it("still requires the sdl a definition is recorded from", () => {
    expect(CreateDeploymentDefinitionRequestSchema.safeParse({ data: {} }).success).toBe(false);
    expect(CreateDeploymentDefinitionRequestSchema.safeParse({ data: { sdl: "version: '2.0'" } }).success).toBe(true);
  });
});

describe("PatchDeploymentRequestSchema", () => {
  describe("the variables secretEnv names", () => {
    it("keeps the names it was given beside a patch that writes them", () => {
      expect(parse({ web: { env: { API_KEY: "x" } } }, { secretEnv: ["API_KEY"] }).data?.data.secretEnv).toEqual(["API_KEY"]);
    });

    it("keeps an empty list beside a patch that writes something", () => {
      expect(parse({ web: { env: { API_KEY: "x" } } }, { secretEnv: [] }).data?.data.secretEnv).toEqual([]);
    });

    it("refuses a name no env variable carries", () => {
      expect(parse({ web: { env: { API_KEY: "x" } } }, { secretEnv: ["A=B"] }).success).toBe(false);
    });

    it("refuses a list in place of a service patch, which names values the patch never writes", () => {
      expect(parse({ web: {} }, { secretEnv: ["API_KEY"] }).success).toBe(false);
    });
  });

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

  describe("env variable names", () => {
    it("accepts a hyphenated name, which the SDL carries and Kubernetes takes", () => {
      expect(parse({ web: { env: { "MY-VAR": "x" } } }).success).toBe(true);
    });

    it("accepts a dotted name", () => {
      expect(parse({ web: { env: { "my.var": "x" } } }).success).toBe(true);
    });

    it("refuses a name carrying an equals sign, which the stored entry cannot spell back", () => {
      expect(parse({ web: { env: { "A=B": "c" } } }).success).toBe(false);
    });

    it("refuses a name carrying a space", () => {
      expect(parse({ web: { env: { "MY VAR": "x" } } }).success).toBe(false);
    });

    it("refuses a name opening with a digit", () => {
      expect(parse({ web: { env: { "1VAR": "x" } } }).success).toBe(false);
    });
  });

  describe("the numbers an exposed port is reached on", () => {
    it("keeps an external port change", () => {
      expect(parseExpose({ as: 8080 }).data?.data.services?.web.expose?.["80"]).toEqual({ as: 8080 });
    });

    it("keeps a container port change", () => {
      expect(parseExpose({ port: 3000 }).data?.data.services?.web.expose?.["80"]).toEqual({ port: 3000 });
    });

    it.each([
      { field: "as", value: 0 },
      { field: "as", value: 65536 },
      { field: "as", value: 80.5 },
      { field: "as", value: "8080" },
      { field: "port", value: 0 },
      { field: "port", value: 65536 },
      { field: "port", value: 80.5 },
      { field: "port", value: "3000" }
    ])("refuses $field $value, which no port can be", ({ field, value }) => {
      expect(parseExpose({ [field]: value }).success).toBe(false);
    });

    it.each([1, 65535])("accepts %i, the edge of the port range", value => {
      expect(parseExpose({ as: value, port: value }).success).toBe(true);
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

  function parseExpose(expose: Record<string, unknown>) {
    return parse({ web: { expose: { "80": expose } } });
  }
});

describe("ListWithResourcesParamsSchema", () => {
  describe("skip", () => {
    it.each(["0", "10", String(Number.MAX_SAFE_INTEGER)])("accepts %s", skip => {
      const result = parse({ skip });

      expect(result.data?.skip).toBe(Number(skip));
    });

    it.each(["-1", "1.5", "Infinity", "1e30", "9007199254740992", "abc"])("rejects %s", skip => {
      const result = parse({ skip });

      expect(result.success).toBe(false);
    });
  });

  describe("limit", () => {
    it.each(["1", "100"])("accepts %s", limit => {
      const result = parse({ limit });

      expect(result.data?.limit).toBe(Number(limit));
    });

    it.each(["0", "101", "10.5"])("rejects %s", limit => {
      const result = parse({ limit });

      expect(result.success).toBe(false);
    });
  });

  function parse(input: { skip?: string; limit?: string }) {
    return ListWithResourcesParamsSchema.safeParse({ address: createAkashAddress(), skip: "0", limit: "10", ...input });
  }
});

describe("ListDeploymentsQuerySchema", () => {
  describe("skip", () => {
    it.each(["0", String(Number.MAX_SAFE_INTEGER)])("accepts %s", skip => {
      const result = ListDeploymentsQuerySchema.safeParse({ skip });

      expect(result.data?.skip).toBe(Number(skip));
    });

    it.each(["-1", "9007199254740992", "1e30"])("rejects %s", skip => {
      const result = ListDeploymentsQuerySchema.safeParse({ skip });

      expect(result.success).toBe(false);
    });
  });
});
