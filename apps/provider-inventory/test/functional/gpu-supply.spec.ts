import { serve } from "@hono/node-server";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Hono } from "hono";
import type { AddressInfo } from "node:net";
import { container } from "tsyringe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GpuSupplyResponse } from "@src/http-schemas/gpu-supply.schema";
import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import { AUDITOR } from "@src/repositories/bid-screening/bid-screening.repository";
import { gpuSupplyRouter } from "@src/routes";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import type { AppEnv } from "@src/types/app-context";
import type { ClusterState } from "@src/types/inventory";
import { testDb } from "../setup-functional-tests";

describe("GET /v1/gpu-supply", () => {
  let stopServer: () => Promise<void>;

  beforeEach(async () => {
    await testDb.truncate();
  });

  afterEach(async () => {
    await stopServer?.();
  });

  it("lists free gpus per provider node for one model", async () => {
    const { request, db } = await setup();
    await seedGpuProvider(db, { owner: "akash1one", model: "h100", auditedBy: [AUDITOR], allocatable: 8, allocated: 3 });
    await seedGpuProvider(db, { owner: "akash1two", model: "h100", auditedBy: [AUDITOR], allocatable: 4, allocated: 0 });
    await seedGpuProvider(db, { owner: "akash1other", model: "a100", auditedBy: [AUDITOR], allocatable: 4, allocated: 0 });

    const response = await request("/v1/gpu-supply?vendor=NVIDIA&model=H100");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        { owner: "akash1one", node: 1, vendor: "nvidia", model: "h100", memory: "80Gi", interface: "pcie", units: 1, nodeFreeUnits: 5 },
        { owner: "akash1two", node: 1, vendor: "nvidia", model: "h100", memory: "80Gi", interface: "pcie", units: 1, nodeFreeUnits: 4 }
      ] satisfies GpuSupplyResponse["data"]
    });
  });

  it("excludes unaudited providers", async () => {
    const { request, db } = await setup();
    await seedGpuProvider(db, { owner: "akash1audited", model: "h100", auditedBy: [AUDITOR], allocatable: 4, allocated: 0 });
    await seedGpuProvider(db, { owner: "akash1unaudited", model: "h100", auditedBy: [], allocatable: 4, allocated: 0 });

    const response = await request("/v1/gpu-supply?vendor=nvidia&model=h100");

    const body = (await response.json()) as GpuSupplyResponse;
    expect(body.data.map(row => row.owner)).toEqual(["akash1audited"]);
  });

  it("rejects a request without vendor and model", async () => {
    const { request } = await setup();

    const response = await request("/v1/gpu-supply");

    expect(response.status).toBe(400);
  });

  async function setup() {
    const app = new Hono<AppEnv>();
    app.route("/", gpuSupplyRouter);
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

async function seedGpuProvider(
  db: PostgresJsDatabase,
  input: { owner: string; model: string; auditedBy: string[]; allocatable: number; allocated: number }
): Promise<void> {
  const inventory: ClusterState = {
    nodes: [
      {
        name: "node-1",
        cpu: { allocatable: 1000, allocated: 0 },
        memory: { allocatable: 1000, allocated: 0 },
        ephemeralStorage: { allocatable: 1000, allocated: 0 },
        gpu: {
          quantity: { allocatable: input.allocatable, allocated: input.allocated },
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
    maxNodeFreeGpu: BigInt(input.allocatable - input.allocated),
    selfAttributes: [{ key: `capabilities/gpu/vendor/nvidia/model/${input.model}`, value: "true" }],
    auditedBy: input.auditedBy,
    inventory
  });
}
