import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { createApp } from "@src/app";
import { envSchema } from "@src/config/env.config";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import { BlockQueryService } from "@src/services/block-query/block-query.service";

describe(createApp.name, () => {
  it("serves the query routes and the OpenAPI document on the api role", async () => {
    const { app } = setup({ role: "api" });

    expect((await app.request("/v1/blocks?limit=1")).status).toBe(200);
    expect((await app.request("/v1/doc")).status).toBe(200);
  });

  it("does not mount the query routes or the OpenAPI document on a writer role", async () => {
    const { app } = setup({ role: "sync" });

    expect((await app.request("/v1/blocks?limit=1")).status).toBe(404);
    expect((await app.request("/v1/doc")).status).toBe(404);
  });

  function setup(input: { role: "api" | "sync" }) {
    const blockQuery = mock<BlockQueryService>();
    blockQuery.listLatest.mockResolvedValue([]);
    container.registerInstance(BlockQueryService, blockQuery);
    container.registerInstance(APP_CONFIG, envSchema.parse({ POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit", INDEXER_ROLE: input.role }));
    return { app: createApp(input.role) };
  }
});
