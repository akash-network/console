import type { UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SettingsContextType } from "@src/context/SettingsProvider";
import type { DepositParams } from "@src/types/deployment";
import { useChainParam } from "./useChainParam";

import { renderHook } from "@testing-library/react";

describe(useChainParam.name, () => {
  it("returns zeros when deposit params are undefined", () => {
    const { result } = setup({ depositParams: undefined });

    expect(result.current.minDeposit).toEqual({ akt: 0, usdc: 0 });
  });

  it("converts uakt and usdc amounts", () => {
    const usdcDenom = "ibc/uusdc";
    const { result } = setup({
      usdcDenom,
      depositParams: [
        { denom: "uakt", amount: "1234567" },
        { denom: usdcDenom, amount: "2500000" }
      ]
    });

    expect(result.current.minDeposit).toEqual({ akt: 1.235, usdc: 2.5 });
  });

  it("returns 0 for missing denom", () => {
    const usdcDenom = "ibc/uusdc";
    const { result } = setup({
      usdcDenom,
      depositParams: [{ denom: usdcDenom, amount: "2500000" }]
    });

    expect(result.current.minDeposit).toEqual({ akt: 0, usdc: 2.5 });
  });

  it("passes enabled=false to useDepositParams when settings are not initialized", () => {
    const { useDepositParamsSpy } = setup({ isSettingsInit: false });

    expect(useDepositParamsSpy).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("passes enabled=false to useDepositParams when blockchain is down", () => {
    const { useDepositParamsSpy } = setup({ isBlockchainDown: true });

    expect(useDepositParamsSpy).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("passes enabled=true to useDepositParams when settings are initialized and blockchain is up", () => {
    const { useDepositParamsSpy } = setup({ isSettingsInit: true, isBlockchainDown: false });

    expect(useDepositParamsSpy).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  function setup(input?: { isSettingsInit?: boolean; isBlockchainDown?: boolean; usdcDenom?: string; depositParams?: DepositParams[] | undefined }) {
    const isSettingsInit = input?.isSettingsInit ?? true;
    const isBlockchainDown = input?.isBlockchainDown ?? false;
    const usdcDenom = input?.usdcDenom ?? "ibc/uusdc";
    const depositParams = input?.depositParams;

    const depositParamsResult = mock<UseQueryResult<DepositParams[], Error>>();
    depositParamsResult.data = depositParams;
    const useDepositParamsSpy = vi.fn().mockReturnValue(depositParamsResult);
    const useUsdcDenomSpy = vi.fn().mockReturnValue(usdcDenom);

    const { result } = renderHook(() =>
      useChainParam({
        dependencies: {
          useDepositParams: useDepositParamsSpy,
          useUsdcDenom: useUsdcDenomSpy,
          useSettings: () =>
            ({
              isSettingsInit,
              settings: mock({
                isBlockchainDown
              })
            }) as SettingsContextType
        }
      })
    );

    return { result, useDepositParamsSpy, useUsdcDenomSpy };
  }
});
