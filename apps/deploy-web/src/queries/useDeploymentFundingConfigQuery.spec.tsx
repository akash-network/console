import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import { useDeploymentFundingConfigQuery } from "./useDeploymentFundingConfigQuery";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useDeploymentFundingConfigQuery.name, () => {
  it("returns the funding config data", async () => {
    const config = { targetRunwayHours: 48, balanceHeadroomUsd: 5, defaultDepositUsd: 0.5 };
    const getDeploymentFundingConfig = vi.fn().mockResolvedValue({ data: config });
    const api = createProxy({ v1: { getDeploymentFundingConfig } }) as unknown as ApiService;

    const { result } = setupQuery(() => useDeploymentFundingConfigQuery(), {
      services: { api: () => api }
    });

    await vi.waitFor(() => {
      expect(getDeploymentFundingConfig).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(config);
    });
  });
});
