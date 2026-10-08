import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import { useSpendRateQuery } from "./useSpendRateQuery";

import { waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useSpendRateQuery.name, () => {
  it("asks the api what the account's running deployments cost", async () => {
    const { result, getSpendRate } = setup();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getSpendRate).toHaveBeenCalledTimes(1);
  });

  it("answers what each running deployment costs per block in USD", async () => {
    const { result } = setup({
      deployments: [
        { dseq: "1", price: { denom: UACT_DENOM, amount: "1000000.000000000000000000" } },
        { dseq: "2", price: { denom: UACT_DENOM, amount: "250000.000000000000000000" } }
      ]
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Object.fromEntries(result.current.data ?? [])).toEqual({ "1": 1, "2": 0.25 });
  });

  it("counts only the denom deployments are funded in", async () => {
    const { result } = setup({
      deployments: [
        { dseq: "1", price: { denom: UACT_DENOM, amount: "1000000.000000000000000000" } },
        { dseq: "1", price: { denom: UAKT_DENOM, amount: "5000000.000000000000000000" } }
      ]
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Object.fromEntries(result.current.data ?? [])).toEqual({ "1": 1 });
  });

  it("answers nothing running when no deployment is", async () => {
    const { result } = setup({ deployments: [] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.size).toBe(0);
  });

  it("reads an account with no wallet yet as running nothing rather than as a failure", async () => {
    const { result } = setup({ rejectWith: new ApiError(404, { message: "UserWallet Not Found" }, "not found") });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.size).toBe(0);
  });

  it("reads a wallet that is not initialized yet the same way", async () => {
    const { result } = setup({ rejectWith: new ApiError(403, { message: "UserWallet is not initialized" }, "forbidden") });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.size).toBe(0);
  });

  it("reports a server fault rather than swallowing it as an account running nothing", async () => {
    const { result } = setup({ rejectWith: new ApiError(500, { message: "boom" }, "server error") });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("asks for nothing while it is disabled", async () => {
    const { result, getSpendRate } = setup({ enabled: false });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    expect(getSpendRate).not.toHaveBeenCalled();
  });

  function setup(
    input: {
      deployments?: Array<{ dseq: string; price: { denom: string; amount: string } }>;
      enabled?: boolean;
      rejectWith?: unknown;
    } = {}
  ) {
    const getSpendRate = vi.fn(async () => (input.rejectWith ? Promise.reject(input.rejectWith) : { data: { deployments: input.deployments ?? [] } }));

    const api = createProxy({ v1: { getSpendRate } }) as unknown as ApiService;
    const hook = setupQuery(() => useSpendRateQuery({ enabled: input.enabled ?? true }), { services: { api: () => api } });

    return { ...hook, getSpendRate };
  }
});
