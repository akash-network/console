import { serve } from "@hono/node-server";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Hono } from "hono";
import type { AddressInfo } from "node:net";
import { container } from "tsyringe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PlacementOptionsResponse } from "@src/http-schemas/placement-options.schema";
import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import { AUDITOR } from "@src/repositories/bid-screening/bid-screening.repository";
import { placementOptionsRouter } from "@src/routes";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import type { AppEnv } from "@src/types/app-context";
import type { ClusterState } from "@src/types/inventory";
import { testDb } from "../setup-functional-tests";

describe("GET /v1/placement-options", () => {
  let stopServer: () => Promise<void>;

  beforeEach(async () => {
    await testDb.truncate();
  });

  afterEach(async () => {
    await stopServer?.();
  });

  it("offers gpus of audited providers only", async () => {
    const { request, db } = await setup();
    await seedGpuProvider(db, { owner: "akash1audited", model: "h100", auditedBy: [AUDITOR] });
    await seedGpuProvider(db, { owner: "akash1unaudited", model: "a100", auditedBy: [] });

    const response = await request("/v1/placement-options");

    expect(response.status).toBe(200);
    expect(modelNames(await response.json())).toEqual(["h100"]);
  });

  it("offers gpus of unaudited providers too when asked to", async () => {
    const { request, db } = await setup();
    await seedGpuProvider(db, { owner: "akash1audited", model: "h100", auditedBy: [AUDITOR] });
    await seedGpuProvider(db, { owner: "akash1unaudited", model: "a100", auditedBy: [] });

    const response = await request("/v1/placement-options?includeUnaudited=true");

    expect(response.status).toBe(200);
    expect(modelNames(await response.json())).toEqual(["a100", "h100"]);
  });

  it("rejects a value other than true or false", async () => {
    const { request } = await setup();

    const response = await request("/v1/placement-options?includeUnaudited=yes");

    expect(response.status).toBe(400);
  });

  async function setup() {
    const app = new Hono<AppEnv>();
    app.route("/", placementOptionsRouter);
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

function modelNames(response: PlacementOptionsResponse): string[] {
  return response.gpus.flatMap(vendor => vendor.models.map(model => model.name));
}

async function seedGpuProvider(db: PostgresJsDatabase, input: { owner: string; model: string; auditedBy: string[] }): Promise<void> {
  const inventory: ClusterState = {
    nodes: [
      {
        name: "node-1",
        cpu: { allocatable: 1000, allocated: 0 },
        memory: { allocatable: 1000, allocated: 0 },
        ephemeralStorage: { allocatable: 1000, allocated: 0 },
        gpu: {
          quantity: { allocatable: 4, allocated: 0 },
          info: [{ vendor: "nvidia", name: input.model, modelId: "0x2330", interface: "pcie", memorySize: "80Gi" }]
        },
        storageClasses: [],
        cpus: []
      }
    ],
    storage: {}
  };

  await db.insert(providerInventory).values({
    owner: input.owner,
    hostUri: `https://${input.owner}:8443`,
    isOnline: true,
    isOnlineSince: new Date(),
    maxNodeFreeGpu: 4n,
    selfAttributes: [{ key: `capabilities/gpu/vendor/nvidia/model/${input.model}`, value: "true" }],
    auditedBy: input.auditedBy,
    inventory
  });
}
