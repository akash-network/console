import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { createApp } from "@src/app";
import type { BlockSummary } from "@src/http-schemas/blocks.schema";
import { BlockQueryService } from "@src/services/block-query/block-query.service";

describe("blocksRouter", () => {
  it("lists the latest blocks with the requested limit", async () => {
    const { app, blockQuery } = setup();
    const block = buildSummary(42);
    blockQuery.listLatest.mockResolvedValue([block]);

    const response = await app.request("/v1/blocks?limit=5");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [block] });
    expect(blockQuery.listLatest).toHaveBeenCalledWith(5);
  });

  it("defaults the limit to 20 and rejects one above 100", async () => {
    const { app, blockQuery } = setup();
    blockQuery.listLatest.mockResolvedValue([]);

    await app.request("/v1/blocks");
    const rejected = await app.request("/v1/blocks?limit=101");

    expect(blockQuery.listLatest).toHaveBeenCalledWith(20);
    expect(rejected.status).toBe(400);
  });

  it("returns a block by height and 404 for a height that is not indexed", async () => {
    const { app, blockQuery } = setup();
    const block = { ...buildSummary(42), parentHash: null, transactions: [] };
    blockQuery.getByHeight.mockImplementation(async height => (height === 42 ? block : null));

    const found = await app.request("/v1/blocks/42");
    const missing = await app.request("/v1/blocks/43");

    expect(await found.json()).toEqual({ data: block });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual(expect.objectContaining({ code: "not_found" }));
  });

  it("rejects a non-numeric height", async () => {
    const { app } = setup();

    expect((await app.request("/v1/blocks/latest")).status).toBe(400);
  });

  function setup() {
    const blockQuery = mock<BlockQueryService>();
    container.registerInstance(BlockQueryService, blockQuery);
    return { app: createApp(), blockQuery };
  }

  function buildSummary(height: number): BlockSummary {
    return {
      height,
      datetime: "2026-08-11T00:00:00.000Z",
      hash: "AA",
      proposer: { address: "PROP", operatorAddress: null, moniker: null },
      transactionCount: 0
    };
  }
});
