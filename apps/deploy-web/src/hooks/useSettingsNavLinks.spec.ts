import { describe, expect, it } from "vitest";

import type { DEPENDENCIES } from "./useSettingsNavLinks";
import { useSettingsNavLinks } from "./useSettingsNavLinks";

import { renderHook } from "@testing-library/react";

describe(useSettingsNavLinks.name, () => {
  it("includes every settings item", () => {
    const links = setup({});

    expect(links.map(link => link.title)).toEqual(["Billing", "API Keys", "Usage", "Alerts"]);
  });

  it("marks the item matching the current route as active", () => {
    const links = setup({ pathname: "/usage" });

    expect(links.find(link => link.title === "Usage")?.isActive).toBe(true);
    expect(links.find(link => link.title === "Billing")?.isActive).toBe(false);
  });

  it("marks Billing active on the billing route", () => {
    const links = setup({ pathname: "/billing" });

    expect(links.find(link => link.title === "Billing")?.isActive).toBe(true);
  });

  it("treats sub-routes as active", () => {
    const links = setup({ pathname: "/alerts/notification-channels/new" });

    expect(links.find(link => link.title === "Alerts")?.isActive).toBe(true);
  });

  function setup(input: { pathname?: string }) {
    const dependencies: typeof DEPENDENCIES = {
      usePathname: () => input.pathname ?? "/"
    };

    return renderHook(() => useSettingsNavLinks({ dependencies })).result.current;
  }
});
