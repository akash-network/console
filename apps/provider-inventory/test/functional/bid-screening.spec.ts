import { generateManifest, type SDLInput, yaml } from "@akashnetwork/chain-sdk";
import { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { serve } from "@hono/node-server";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Hono } from "hono";
import type { AddressInfo } from "node:net";
import { container } from "tsyringe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BidScreeningResponse } from "@src/http-schemas/bid-screening.schema";
import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import { AUDITOR } from "@src/repositories/bid-screening/bid-screening.repository";
import { bidScreeningRouter } from "@src/routes";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import type { AppEnv } from "@src/types/app-context";
import type { ClusterState } from "@src/types/inventory";
import { testDb } from "../setup-functional-tests";

const HOST_AKASH_SIGNED_BY_AUDITOR_SDL = `
version: "2.0"
services:
  dart:
    image: google/dart-hello
    expose:
      - port: 8080
        as: 80
        to:
          - global: true
profiles:
  compute:
    dart:
      resources:
        cpu:
          units: 0.1
        memory:
          size: 512Mi
        storage:
          size: 512Mi
  placement:
    akash:
      attributes:
        host: akash
      signedBy:
        anyOf:
          - "${AUDITOR}"
      pricing:
        dart:
          denom: uact
          amount: 10000
deployment:
  dart:
    akash:
      profile: dart
      count: 1
`;

describe("POST /v1/bid-screening", () => {
  let stopServer: () => Promise<void>;

  beforeEach(async () => {
    await testDb.truncate();
  });

  afterEach(async () => {
    await stopServer?.();
  });

  it("screens a group spec serialized by GroupSpec.toJSON down to providers whose auditor signed its placement attributes", async () => {
    const { screen, db } = await setup();
    await seedProvider(db, { owner: "akash1signedHost", auditedBy: [AUDITOR], signedAttributes: [{ key: "host", value: "akash", auditor: AUDITOR }] });
    await seedProvider(db, { owner: "akash1auditedWithoutAttributes", auditedBy: [AUDITOR], signedAttributes: [] });
    await seedProvider(db, { owner: "akash1unaudited", auditedBy: [], signedAttributes: [] });

    const response = await screen(toScreeningRequest(HOST_AKASH_SIGNED_BY_AUDITOR_SDL));

    expect(response.status).toBe(200);
    expect(((await response.json()) as BidScreeningResponse).providers.map(({ owner }) => owner)).toEqual(["akash1signedHost"]);
  });

  async function setup() {
    const app = new Hono<AppEnv>();
    app.route("/", bidScreeningRouter);
    app.onError(container.resolve(HonoErrorHandlerService).handle);

    const server = serve({ fetch: app.fetch, port: 0 });
    await new Promise<void>(resolve => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    stopServer = () => new Promise<void>(resolve => server.close(() => resolve()));

    return {
      db: container.resolve<PostgresJsDatabase>(DRIZZLE_DB),
      screen: (body: unknown) =>
        fetch(`http://127.0.0.1:${port}/v1/bid-screening`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    };
  }
});

function toScreeningRequest(sdl: string) {
  const manifest = generateManifest(yaml.raw(sdl) as SDLInput);
  const [groupSpec] = (manifest as Extract<typeof manifest, { ok: true }>).value.groupSpecs;

  return { ...(GroupSpec.toJSON(groupSpec) as object), timezone: "UTC" };
}

async function seedProvider(
  db: PostgresJsDatabase,
  input: { owner: string; auditedBy: string[]; signedAttributes: { key: string; value: string; auditor: string }[] }
): Promise<void> {
  const inventory: ClusterState = {
    nodes: [
      {
        name: "node-1",
        cpu: { allocatable: 8_000, allocated: 0 },
        memory: { allocatable: 16 * 1024 ** 3, allocated: 0 },
        ephemeralStorage: { allocatable: 100 * 1024 ** 3, allocated: 0 },
        gpu: { quantity: { allocatable: 0, allocated: 0 }, info: [] },
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
    totalAvailableCpu: 8_000n,
    totalAvailableMemory: BigInt(16 * 1024 ** 3),
    totalAvailableEph: BigInt(100 * 1024 ** 3),
    maxNodeFreeCpu: 8_000n,
    maxNodeFreeMemory: BigInt(16 * 1024 ** 3),
    selfAttributes: [{ key: "host", value: "akash" }],
    signedAttributes: input.signedAttributes,
    auditedBy: input.auditedBy,
    inventory
  });
}
