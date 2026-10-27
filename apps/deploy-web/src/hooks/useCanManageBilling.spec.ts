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

  function setup(input: { role?: OrganizationRole }) {
    const activeOrganization = input.role ? mock<OrganizationOutput>({ type: "team", role: input.role }) : undefined;
    const useActiveOrganization: typeof DEPENDENCIES.useActiveOrganization = () =>
      mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ activeOrganization });

    return renderHook(() => useCanManageBilling({ useActiveOrganization }));
  }
});
