import type { AxiosInstance, AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { RpcBmeParams } from "@src/types/bme";
import { getBmeParams } from "./useBmeQuery";

describe(getBmeParams.name, () => {
  it("parses uact coin from min_mint array", async () => {
    const { result } = await setup({
      min_mint: [{ denom: "uact", amount: "10000000" }]
    });

    expect(result.minMintUact).toBe(10_000_000);
    expect(result.minMintAct).toBe(10);
  });

  it("finds uact coin when multiple denoms are present", async () => {
    const { result } = await setup({
      min_mint: [
        { denom: "uakt", amount: "5000000" },
        { denom: "uact", amount: "10000000" },
        { denom: "ibc/usdc", amount: "3000000" }
      ]
    });

    expect(result.minMintUact).toBe(10_000_000);
    expect(result.minMintAct).toBe(10);
  });

  it("falls back to 0 when uact is not in the array", async () => {
    const { result } = await setup({
      min_mint: [{ denom: "uakt", amount: "5000000" }]
    });

    expect(result.minMintUact).toBe(0);
    expect(result.minMintAct).toBe(0);
  });

  it("falls back to 0 when min_mint array is empty", async () => {
    const { result } = await setup({
      min_mint: []
    });

    expect(result.minMintUact).toBe(0);
    expect(result.minMintAct).toBe(0);
  });

  async function setup(input: { min_mint: Array<{ denom: string; amount: string }> }) {
    const chainApiHttpClient = mock<AxiosInstance>();
    chainApiHttpClient.get.mockResolvedValue({
      data: { params: { min_mint: input.min_mint } }
    } as AxiosResponse<RpcBmeParams>);

    const result = await getBmeParams(chainApiHttpClient);

    return { result, chainApiHttpClient };
  }
});
