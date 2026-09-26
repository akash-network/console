import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CHAIN_INDEXER_CONFIG, createChainIndexerConfigInitializer } from "@src/chain-indexer/providers/chain-indexer-config.provider";
import { ON_APP_START } from "@src/core/providers/app-initializer";
import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";

describe(createChainIndexerConfigInitializer.name, () => {
  it("fails at start-up on a malformed CHAIN_INDEXER_API_BASE_URL instead of on the first request", async () => {
    const { startUp } = setup({ CHAIN_INDEXER_API_BASE_URL: "chain-indexer.internal" });

    await expect(startUp()).rejects.toThrow(/CHAIN_INDEXER_API_BASE_URL/);
  });

  it("starts with the url unset and leaves delegation off", async () => {
    const { startUp, config } = setup({});

    await expect(startUp()).resolves.toBeUndefined();
    expect(config().CHAIN_INDEXER_API_BASE_URL).toBeUndefined();
  });

  it("starts with a valid url", async () => {
    const { startUp, config } = setup({ CHAIN_INDEXER_API_BASE_URL: "https://chain-indexer.internal" });

    await expect(startUp()).resolves.toBeUndefined();
    expect(config().CHAIN_INDEXER_API_BASE_URL).toBe("https://chain-indexer.internal");
  });

  function setup(env: Record<string, string>) {
    const child = container.createChildContainer();
    child.register(RAW_APP_CONFIG, { useValue: env });
    const startUp = () => createChainIndexerConfigInitializer(child)[ON_APP_START]();
    return { startUp, config: () => child.resolve(CHAIN_INDEXER_CONFIG) };
  }
});
