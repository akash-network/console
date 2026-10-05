import { serve } from "@hono/node-server";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Hono } from "hono";
import type { AddressInfo } from "node:net";
import { container } from "tsyringe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import { providerRouter } from "@src/routes";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import type { AppEnv } from "@src/types/app-context";
import { testDb } from "../setup-functional-tests";

describe("GET /v1/providers/{owner}", () => {
  let stopServer: () => Promise<void>;

  beforeEach(async () => {
    await testDb.truncate();
  });

  afterEach(async () => {
    await stopServer?.();
  });

  it("returns the reclamation window the provider last reported", async () => {
    const { request, db } = await setup();
    await db.insert(providerInventory).values({ owner: "akash1reclaims", hostUri: "https://reclaims:8443", isOnline: true, reclamationWindow: 86400 });

    const response = await request("/v1/providers/akash1reclaims");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ owner: "akash1reclaims", hostUri: "https://reclaims:8443", isOnline: true, reclamationWindow: 86400 });
  });

  it("answers a null reclamation window for a provider that reports none", async () => {
    const { request, db } = await setup();
    await db.insert(providerInventory).values({ owner: "akash1nowindow", hostUri: "https://nowindow:8443" });

    const response = await request("/v1/providers/akash1nowindow");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ owner: "akash1nowindow", hostUri: "https://nowindow:8443", isOnline: false, reclamationWindow: null });
  });

  it("answers 404 for a provider the inventory does not know", async () => {
    const { request, db } = await setup();
    await db.insert(providerInventory).values({ owner: "akash1known", hostUri: "https://known:8443" });

    const response = await request("/v1/providers/akash1unknown");

    expect(response.status).toBe(404);
  });

  async function setup() {
    const app = new Hono<AppEnv>();
    app.route("/", providerRouter);
    app.onError(container.resolve(HonoErrorHandlerService).handle);

    const server = serve({ fetch: app.fetch, port: 0 });
    await new Promise<void>(resolve => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    stopServer = () => new Promise<void>(resolve => server.close(() => resolve()));

    return {
      db: container.resolve<PostgresJsDatabase>(DRIZZLE_DB),
      request: (path: string) => fetch(`http://127.0.0.1:${port}${path}`)
    };
  }
});
