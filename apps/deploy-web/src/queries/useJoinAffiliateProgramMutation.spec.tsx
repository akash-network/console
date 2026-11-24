import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { useJoinAffiliateProgramMutation } from "./useJoinAffiliateProgramMutation";

import { act } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useJoinAffiliateProgramMutation.name, () => {
  it("joins the program and refetches the profile and the eligibility", async () => {
    const { result, joinAffiliateProgram, invalidateQueries, api } = setup({});

    await act(() => result.current.mutateAsync(undefined));

    expect(joinAffiliateProgram).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: api.v1.getAffiliateProfile.getKey() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: api.v1.getAffiliateEnrollmentEligibility.getKey() });
  });

  it("leaves both queries alone when joining fails", async () => {
    const { result, invalidateQueries } = setup({ failure: new Error("forbidden") });

    await act(() => result.current.mutateAsync(undefined).catch(() => undefined));

    expect(invalidateQueries).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(result.current.isError).toBe(true));
  });

  function setup(input: { failure?: Error }) {
    const joinAffiliateProgram = vi.fn();
    if (input.failure) joinAffiliateProgram.mockRejectedValue(input.failure);
    else joinAffiliateProgram.mockResolvedValue({ data: { code: "friendcode" } });
    const api = createProxy({
      v1: { joinAffiliateProgram, getAffiliateProfile: vi.fn(), getAffiliateEnrollmentEligibility: vi.fn() }
    }) as unknown as ApiService;
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = setupQuery(() => useJoinAffiliateProgramMutation(), { services: { api: () => api, queryClient: () => queryClient } });

    return { result, joinAffiliateProgram, invalidateQueries, api };
  }
});
