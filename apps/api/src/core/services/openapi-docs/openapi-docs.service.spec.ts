import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { createRoute } from "../../lib/create-route/create-route";
import { OpenApiHonoHandler } from "../open-api-hono-handler/open-api-hono-handler";
import { OpenApiDocsService } from "./openapi-docs.service";
import { SECURITY_NONE } from "./openapi-security";

describe("OpenApiDocsService", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("loads the notifications spec from disk when source = file", async () => {
    const notificationsSpec = {
      openapi: "3.0.0",
      info: { title: "Notif", version: "1.0.0" },
      paths: {
        "/v1/alerts": {
          get: {
            operationId: "listAlerts",
            tags: ["v1"],
            responses: { "200": { description: "ok" } }
          }
        }
      },
      components: { schemas: {} }
    };

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "notif-spec-"));
    const tmpFile = path.join(tmpDir, "swagger.json");
    await fs.writeFile(tmpFile, JSON.stringify(notificationsSpec), "utf8");

    try {
      const { service } = setup({ notificationsSwaggerPath: tmpFile });
      const docs = await service.generateDocs([], { scope: "full", source: "file" });

      expect(docs.paths["/v1/alerts"]).toBeDefined();
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns docs without external paths when source = file and notifications swagger missing", async () => {
    const { service } = setup({ notificationsSwaggerPath: "/does/not/exist.json" });
    const docs = await service.generateDocs([], { scope: "full", source: "file" });

    expect(docs.paths).toEqual({});
  });

  it("ignores notifications spec when scope = console", async () => {
    const { service } = setup({ notificationsSwaggerPath: "/anything.json" });
    const docs = await service.generateDocs([], { scope: "console", source: "file" });

    expect(docs.paths).toEqual({});
  });

  it("defaults to source = http when no source is specified", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        openapi: "3.0.0",
        info: { title: "Notif", version: "1.0.0" },
        paths: {},
        components: { schemas: {} }
      })
    });

    const { service } = setup({ notificationsSwaggerPath: "/should-not-be-read" });
    await service.generateDocs([], { scope: "full" });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns docs without external paths when NOTIFICATIONS_SWAGGER_PATH is missing", async () => {
    const { service } = setup({ notificationsSwaggerPath: "" });
    const docs = await service.generateDocs([], { scope: "full", source: "file" });

    expect(docs.paths).toEqual({});
  });

  it("returns docs without external paths when the HTTP fetch fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    const { service } = setup({});
    const docs = await service.generateDocs([], { scope: "full", source: "http" });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(docs.paths).toEqual({});
  });

  it("does not return a cached file-source spec when the next call uses source = http", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "notif-spec-"));
    const tmpFile = path.join(tmpDir, "swagger.json");
    await fs.writeFile(
      tmpFile,
      JSON.stringify({
        openapi: "3.0.0",
        info: { title: "Notif", version: "1.0.0" },
        paths: {
          "/v1/from-file": {
            get: { operationId: "fromFile", tags: ["v1"], responses: { "200": { description: "ok" } } }
          }
        },
        components: { schemas: {} }
      }),
      "utf8"
    );

    try {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({
          openapi: "3.0.0",
          info: { title: "Notif", version: "1.0.0" },
          paths: {
            "/v1/from-http": {
              get: { operationId: "fromHttp", tags: ["v1"], responses: { "200": { description: "ok" } } }
            }
          },
          components: { schemas: {} }
        })
      });

      const { service } = setup({ notificationsSwaggerPath: tmpFile });

      const fileDocs = await service.generateDocs([], { scope: "full", source: "file" });
      expect(fileDocs.paths["/v1/from-file"]).toBeDefined();

      const httpDocs = await service.generateDocs([], { scope: "full", source: "http" });
      expect(httpDocs.paths["/v1/from-http"]).toBeDefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("excludes routes flagged hiddenInOpenApiDocs from the served spec by default", async () => {
    const { service } = setup({});

    const docs = await service.generateDocs([buildHandler()], { scope: "console" });

    expect(docs.paths["/v1/test-visible"]).toBeDefined();
    expect(docs.paths["/v1/test-hidden"]).toBeUndefined();
  });

  it("includes routes flagged hiddenInOpenApiDocs when includeHidden is true", async () => {
    const { service } = setup({});

    const docs = await service.generateDocs([buildHandler()], { scope: "console", includeHidden: true });

    expect(docs.paths["/v1/test-visible"]).toBeDefined();
    expect(docs.paths["/v1/test-hidden"]).toBeDefined();
  });

  it("does not serve a cached includeHidden spec to a subsequent public request", async () => {
    const { service } = setup({});
    const handler = buildHandler();

    const sdkDocs = await service.generateDocs([handler], { scope: "console", includeHidden: true });
    expect(sdkDocs.paths["/v1/test-hidden"]).toBeDefined();

    const publicDocs = await service.generateDocs([handler], { scope: "console" });
    expect(publicDocs.paths["/v1/test-hidden"]).toBeUndefined();
  });

  // Routes are built here rather than at module scope so createRoute's HIDDEN_ROUTES
  // side effect happens per-test, not as an import-time global mutation.
  function buildHandler() {
    const visibleRoute = createRoute({
      method: "get",
      path: "/v1/test-visible",
      operationId: "listTestVisible",
      summary: "Visible test route",
      tags: ["Test"],
      security: SECURITY_NONE,
      responses: { 200: { description: "OK" } }
    });

    const hiddenRoute = createRoute({
      method: "get",
      path: "/v1/test-hidden",
      operationId: "listTestHidden",
      summary: "Hidden test route",
      tags: ["Test"],
      security: SECURITY_NONE,
      hiddenInOpenApiDocs: true,
      responses: { 200: { description: "OK" } }
    });

    const handler = new OpenApiHonoHandler();
    handler.openapi(visibleRoute, c => c.body(null, 200));
    handler.openapi(hiddenRoute, c => c.body(null, 200));
    return handler;
  }

  function setup(input: { notificationsSwaggerPath?: string }) {
    const service = new OpenApiDocsService(
      mock({ SERVER_ORIGIN: "https://api.test" }),
      mock({ NOTIFICATIONS_API_BASE_URL: "https://notif.test", NOTIFICATIONS_SWAGGER_PATH: input.notificationsSwaggerPath ?? "" })
    );
    return { service };
  }
});
