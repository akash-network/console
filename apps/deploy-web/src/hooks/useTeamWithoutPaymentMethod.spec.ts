import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
import { type DEPENDENCIES, useTeamWithoutPaymentMethod } from "./useTeamWithoutPaymentMethod";

import { renderHook } from "@testing-library/react";

describe(useTeamWithoutPaymentMethod.name, () => {
  it("returns the active team while it has no payment method", () => {
    const { result, activeOrganization } = setup({ activeOrganization: { type: "team", hasPaymentMethod: false } });

    expect(result.current).toEqual(activeOrganization);
  });

  it("returns nothing once the active team has a payment method", () => {
    const { result } = setup({ activeOrganization: { type: "team", hasPaymentMethod: true } });

    expect(result.current).toBeUndefined();
  });

  it("returns nothing while the team's payment method is unknown", () => {
    const { result } = setup({ activeOrganization: { type: "team", hasPaymentMethod: null } });

    expect(result.current).toBeUndefined();
  });

  it("returns nothing in a personal account without a payment method", () => {
    const { result } = setup({ activeOrganization: { type: "personal", hasPaymentMethod: false } });

    expect(result.current).toBeUndefined();
  });

  it("returns nothing without an active organization, as with organizations off", () => {
    const { result } = setup({});

    expect(result.current).toBeUndefined();
  });

  function setup(input: { activeOrganization?: Pick<OrganizationOutput, "type" | "hasPaymentMethod"> }) {
    const activeOrganization = input.activeOrganization
      ? { id: "org-1", name: "Acme", slug: "acme", role: "member" as const, isActive: true, createdAt: "", ...input.activeOrganization }
      : undefined;
    const useActiveOrganization: typeof DEPENDENCIES.useActiveOrganization = () =>
      mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ activeOrganization });

    const hook = renderHook(() => useTeamWithoutPaymentMethod({ useActiveOrganization }));

    return { ...hook, activeOrganization };
  }
});
