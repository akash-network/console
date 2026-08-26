import { serve } from "@hono/node-server";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Hono } from "hono";
import type { AddressInfo } from "node:net";
import { container } from "tsyringe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { providerIncidents } from "@src/model-schemas/provider-incident/provider-incident.schema";
import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import { providerOutagesRouter } from "@src/routes";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import type { AppEnv } from "@src/types/app-context";
import { testDb } from "../setup-functional-tests";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe("GET /v1/provider-outages", () => {
  let stopServer: () => Promise<void>;

  beforeEach(async () => {
    await testDb.truncate();
  });

  afterEach(async () => {
    await stopServer?.();
  });

  it("returns providers that have been unreachable for at least the requested number of days", async () => {
    const { request, db } = await setup();
    const startedAt = daysAgo(5);
    const lastAttemptAt = daysAgo(0);
    await seedOutage(db, { provider: "akash1dark", hostUri: "https://dark:8443", startedAt, lastAttemptAt });

    const response = await request("/v1/provider-outages?minAgeDays=3");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      outages: [
        {
          provider: "akash1dark",
          hostUri: "https://dark:8443",
          startedAt: startedAt.toISOString(),
          lastAttemptAt: lastAttemptAt.toISOString()
        }
      ]
    });
  });

  it("leaves out providers whose outage is younger than the requested number of days", async () => {
    const { request, db } = await setup();
    await seedOutage(db, { provider: "akash1recent", startedAt: daysAgo(1) });

    const response = await request("/v1/provider-outages?minAgeDays=3");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outages: [] });
  });

  it("rejects a request that does not say how old the outages must be", async () => {
    const { request } = await setup();

    const response = await request("/v1/provider-outages");

    expect(response.status).toBe(400);
  });

  it("rejects a non-numeric age", async () => {
    const { request } = await setup();

    const response = await request("/v1/provider-outages?minAgeDays=forever");

    expect(response.status).toBe(400);
  });

  async function setup() {
    const app = new Hono<AppEnv>();
    app.route("/", providerOutagesRouter);
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

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_IN_MS);
}

async function seedOutage(db: PostgresJsDatabase, input: { provider: string; hostUri?: string; startedAt: Date; lastAttemptAt?: Date }): Promise<void> {
  await db.insert(providerInventory).values({ owner: input.provider, hostUri: input.hostUri ?? `https://${input.provider}:8443` });
  await db.insert(providerIncidents).values({
    provider: input.provider,
    startedAt: input.startedAt,
    lastAttemptAt: input.lastAttemptAt ?? input.startedAt,
    endedAt: null
  });
}
