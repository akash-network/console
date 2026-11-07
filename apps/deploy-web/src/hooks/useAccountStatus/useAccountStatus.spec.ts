import { describe, expect, it, vi } from "vitest";

import type { CustomUserProfile } from "@src/types/user";
import type { DEPENDENCIES } from "./useAccountStatus";
import { useAccountStatus } from "./useAccountStatus";

import { renderHook } from "@testing-library/react";

describe(useAccountStatus.name, () => {
  it("lets an active account spend and change things", () => {
    const { result } = setup({ user: { accountStatus: "active", accountStatusReason: "stale reason" } });

    expect(result.current).toEqual({
      status: "active",
      reason: null,
      isSuspended: false,
      isTerminated: false,
      canSpend: true,
      canMutate: true
    });
  });

  it("stops a suspended account from spending but lets it change things", () => {
    const { result } = setup({ user: { accountStatus: "suspended", accountStatusReason: "Unpaid invoice" } });

    expect(result.current).toEqual({
      status: "suspended",
      reason: "Unpaid invoice",
      isSuspended: true,
      isTerminated: false,
      canSpend: false,
      canMutate: true
    });
  });

  it("makes a terminated account read-only", () => {
    const { result } = setup({ user: { accountStatus: "terminated", accountStatusReason: "Terms of service violation" } });

    expect(result.current).toEqual({
      status: "terminated",
      reason: "Terms of service violation",
      isSuspended: false,
      isTerminated: true,
      canSpend: false,
      canMutate: false
    });
  });

  it("has no reason for a restricted account the API gave none for", () => {
    const { result } = setup({ user: { accountStatus: "suspended" } });

    expect(result.current.reason).toBeNull();
  });

  it("treats a profile without a status as active", () => {
    const { result } = setup({ user: undefined });

    expect(result.current.status).toBe("active");
    expect(result.current.canSpend).toBe(true);
  });

  function setup(input: { user: Partial<CustomUserProfile> | undefined }) {
    const useUser: typeof DEPENDENCIES.useUser = () => ({ user: input.user, isLoading: false, error: undefined, checkSession: vi.fn() });

    return renderHook(() => useAccountStatus({ useUser }));
  }
});
