import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput, OrganizationRole } from "@src/types/organization";
import { type DEPENDENCIES, useCanManageBilling } from "./useCanManageBilling";

import { renderHook } from "@testing-library/react";

describe(useCanManageBilling.name, () => {
  it.each<OrganizationRole>(["owner", "billing"])("lets the %s of the active organization manage billing", role => {
    const { result } = setup({ role });

    expect(result.current).toBe(true);
  });

  it.each<OrganizationRole>(["admin", "member", "viewer"])("keeps the %s of the active organization from managing billing", role => {
    const { result } = setup({ role });

    expect(result.current).toBe(false);
  });

  it("lets the user manage billing without an active organization, as with organizations off", () => {
    const { result } = setup({});

    expect(result.current).toBe(true);
  });

  it("keeps billing closed while the memberships load", () => {
    const { result } = setup({ isLoading: true });

    expect(result.current).toBe(false);
  });

  it("keeps billing closed when the memberships could not be loaded", () => {
    const { result } = setup({ isError: true });

    expect(result.current).toBe(false);
  });

  it("judges by the active organization's role once known, even while memberships refresh", () => {
    const { result } = setup({ role: "owner", isLoading: true, isError: true });

    expect(result.current).toBe(true);
  });

  function setup(input: { role?: OrganizationRole; isLoading?: boolean; isError?: boolean }) {
    const activeOrganization = input.role ? mock<OrganizationOutput>({ type: "team", role: input.role }) : undefined;
    const useActiveOrganization: typeof DEPENDENCIES.useActiveOrganization = () =>
      mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
        activeOrganization,
        isLoading: input.isLoading ?? false,
        isError: input.isError ?? false
      });

    return renderHook(() => useCanManageBilling({ useActiveOrganization }));
  }
});
