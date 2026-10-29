import type { AuthzHttpService, FeeAllowance } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useFeeAllowanceExistenceQuery } from "./useFeeAllowanceQuery";

import { setupQuery } from "@tests/unit/query-client";

describe(useFeeAllowanceExistenceQuery.name, () => {
  it("returns true when the address holds a valid fee allowance", async () => {
    const { result } = setup({ allowances: [mock<FeeAllowance>()] });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBe(true);
  });

  it("returns false when the address holds no valid fee allowance", async () => {
    const { result } = setup({ allowances: [] });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBe(false);
  });

  it("asks the authz service about the queried address", async () => {
    const { result, authzHttpService } = setup({ allowances: [] });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(authzHttpService.getValidFeeAllowancesForGrantee).toHaveBeenCalledWith("akash1grantee");
  });

  it("does not look anything up when disabled", () => {
    const { authzHttpService } = setup({ allowances: [], enabled: false });

    expect(authzHttpService.getValidFeeAllowancesForGrantee).not.toHaveBeenCalled();
  });

  function setup(input: { allowances: FeeAllowance[]; enabled?: boolean }) {
    const authzHttpService = mock<AuthzHttpService>();
    authzHttpService.getValidFeeAllowancesForGrantee.mockResolvedValue(input.allowances);
    const { result } = setupQuery(() => useFeeAllowanceExistenceQuery("akash1grantee", { enabled: input.enabled }), {
      services: {
        authzHttpService: () => authzHttpService
      }
    });
    return { result, authzHttpService };
  }
});
