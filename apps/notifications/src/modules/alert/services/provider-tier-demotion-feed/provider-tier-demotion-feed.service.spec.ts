import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AlertConfig } from "@src/modules/alert/config";
import { ProviderTierDemotionFeedService } from "@src/modules/alert/services/provider-tier-demotion-feed/provider-tier-demotion-feed.service";

describe(ProviderTierDemotionFeedService.name, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests and validates the private cursor feed", async () => {
    const service = await setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(FEED), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(service.get("10")).resolves.toEqual(FEED);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.akash.network/internal/v1/provider-verification/tier-demotions?after=10&limit=50&token=private-token");
    expect(init).toMatchObject({ headers: { accept: "application/json" } });
  });

  it("does not accept an unavailable feed as progress", async () => {
    const service = await setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"provider_verification_not_ready"}', { status: 503 })));

    await expect(service.get("10")).rejects.toThrow("HTTP 503");
  });

  it("rejects malformed feed data at the HTTP boundary", async () => {
    const service = await setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...FEED, nextCursor: "invalid" }), { status: 200 })));

    await expect(service.get("10")).rejects.toThrow();
  });

  async function setup() {
    const configService = {
      get: vi.fn((key: keyof AlertConfig) => (key === "alert.CONSOLE_API_SECRET_TOKEN" ? "private-token" : undefined)),
      getOrThrow: vi.fn((key: keyof AlertConfig) => {
        if (key === "alert.CONSOLE_API_ENDPOINT") return "https://api.akash.network";
        if (key === "alert.PROVIDER_TIER_DEMOTION_PAGE_SIZE") return 50;
        throw new Error(`Unexpected config key: ${key}`);
      })
    };
    const module = await Test.createTestingModule({
      providers: [ProviderTierDemotionFeedService, { provide: ConfigService, useValue: configService }]
    }).compile();

    return module.get(ProviderTierDemotionFeedService);
  }
});

const FEED = {
  streamId: "5be32550-fbc2-4f02-9ac2-7d58f0362451",
  headCursor: "12",
  nextCursor: "11",
  moduleActive: true,
  items: [
    {
      cursor: "11",
      provider: "akash1provideraddressxxxxxxxxxxxxxxxxxxxxxx",
      previous: { effectiveTier: "L3", maxPlacementTier: "L3", snapshotState: "current" },
      current: { effectiveTier: "L1", maxPlacementTier: "L1", snapshotState: "stale" },
      changes: ["tier_gate", "snapshot_eligibility"],
      observedHeight: "12345",
      observedAt: "2026-08-25T00:00:00.000Z"
    }
  ]
};
