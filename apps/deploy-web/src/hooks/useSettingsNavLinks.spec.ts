import { describe, expect, it } from "vitest";

import { DEPENDENCIES, useSettingsNavLinks } from "./useSettingsNavLinks";

import { renderHook } from "@testing-library/react";

describe(useSettingsNavLinks.name, () => {
  it("includes every item when billing and alerts flags are on", () => {
    const links = setup({ flags: { billing_usage: true, alerts: true } });

    expect(links.map(link => link.title)).toEqual(["Billing", "API Keys", "Usage", "Alerts"]);
  });

  it("hides flag-gated items when flags are off", () => {
    const links = setup({ flags: {} });

    expect(links.map(link => link.title)).toEqual(["API Keys"]);
  });

  it("marks the item matching the current route as active", () => {
    const links = setup({ flags: { billing_usage: true, alerts: true }, pathname: "/usage" });

    expect(links.find(link => link.title === "Usage")?.isActive).toBe(true);
    expect(links.find(link => link.title === "Billing")?.isActive).toBe(false);
  });

  it("marks Billing active on the billing route", () => {
    const links = setup({ flags: { billing_usage: true }, pathname: "/billing" });

    expect(links.find(link => link.title === "Billing")?.isActive).toBe(true);
  });

  it("treats sub-routes as active", () => {
    const links = setup({ flags: { alerts: true }, pathname: "/alerts/notification-channels/new" });

    expect(links.find(link => link.title === "Alerts")?.isActive).toBe(true);
  });

  function setup(input: { flags?: Record<string, boolean>; pathname?: string }) {
    const dependencies = {
      ...DEPENDENCIES,
      useFlag: (flag: string) => input.flags?.[flag] ?? false,
      usePathname: () => input.pathname ?? "/"
    } as unknown as typeof DEPENDENCIES;

    return renderHook(() => useSettingsNavLinks({ dependencies })).result.current;
  }
});
