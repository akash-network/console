import { describe, expect, it } from "vitest";

import { envSchema } from "@src/config/env.config";
import { addressTransactionsRouter } from "@src/routes/address-transactions/address-transactions.router";
import { blocksRouter } from "@src/routes/blocks/blocks.router";
import { healthzRouter } from "@src/routes/healthz/healthz.router";
import { networkStatsRouter } from "@src/routes/network-stats/network-stats.router";
import { statusRouter } from "@src/routes/status/status.router";
import { OpenApiDocsService } from "@src/services/openapi-docs/openapi-docs.service";

describe(OpenApiDocsService.name, () => {
  it("merges every handler's routes into one document whose operations are addressable by id", () => {
    const { service } = setup();

    const document = service.generate([blocksRouter, addressTransactionsRouter, networkStatsRouter, statusRouter, healthzRouter]);

    const operationIds = Object.values(document.paths).flatMap(item =>
      Object.values(item as Record<string, { operationId?: string }>).map(op => op.operationId)
    );
    expect(operationIds).toEqual(expect.arrayContaining(["listBlocks", "getBlock", "listAddressTransactions", "getNetworkStats", "getStatus"]));
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining(["/v1/blocks", "/v1/blocks/{height}", "/v1/addresses/{address}/transactions", "/v1/network-stats", "/v1/status", "/v1/healthz"])
    );
    expect(document.info.title).toBe("Akash Chain Indexer API");
    expect(document.info.version).toBe("v1");
  });

  it("advertises the configured server origin", () => {
    const { service } = setup({ serverOrigin: "https://chain-indexer.example" });

    expect(service.generate([healthzRouter]).servers).toEqual([{ url: "https://chain-indexer.example" }]);
  });

  it("lists no server when no origin is configured", () => {
    const { service } = setup();

    expect(service.generate([healthzRouter]).servers).toEqual([]);
  });

  function setup(input?: { serverOrigin?: string }) {
    const config = envSchema.parse({
      POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit",
      ...(input?.serverOrigin ? { SERVER_ORIGIN: input.serverOrigin } : {})
    });
    return { service: new OpenApiDocsService(config) };
  }
});
