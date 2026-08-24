import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FallbackableHttpClient } from "@src/services/createFallbackableHttpClient/createFallbackableHttpClient";
import { setupQuery } from "../../tests/unit/query-client";
import { useRealTimeLeft } from "./useRealTimeLeft";

describe(useRealTimeLeft.name, () => {
  it("drains the escrow by what the provider earned since the last settlement", async () => {
    const { result } = setup({ pricePerBlock: 100, balance: 50_000, settledAt: 1000, latestBlockHeight: 1100 });

    await vi.waitFor(() => {
      expect(result.current?.escrow).toBe(40_000);
    });
  });

  it("reports the settled escrow when no lease is spending", async () => {
    const { result } = setup({ pricePerBlock: 0, balance: 50_000, settledAt: 1000, latestBlockHeight: 1100 });

    await vi.waitFor(() => {
      expect(result.current?.escrow).toBe(50_000);
    });
  });

  it("clamps the escrow at zero once the accrued spend exceeds the balance", async () => {
    const { result } = setup({ pricePerBlock: 100, balance: 5_000, settledAt: 1000, latestBlockHeight: 1100 });

    await vi.waitFor(() => {
      expect(result.current?.escrow).toBe(0);
    });
  });

  function setup(input: { pricePerBlock: number; balance: number; settledAt: number; latestBlockHeight: number }) {
    const chainApiHttpClient = mock<FallbackableHttpClient>();
    chainApiHttpClient.isFallbackEnabled = false;
    chainApiHttpClient.defaults = mock<FallbackableHttpClient["defaults"]>({ baseURL: "https://chain.test" });
    chainApiHttpClient.get.mockResolvedValue({ data: { block: { header: { height: String(input.latestBlockHeight) } } } });

    return setupQuery(() => useRealTimeLeft(input.pricePerBlock, input.balance, input.settledAt, 900), {
      services: { chainApiHttpClient: () => chainApiHttpClient }
    });
  }
});
