import { describe, expect, it } from "vitest";

import { COMMAND_PAGES } from "./commandMenuCatalog";

describe("COMMAND_PAGES", () => {
  it("lists the pages the menu can open, in order, with their routes", () => {
    expect(COMMAND_PAGES.map(({ id, label, href }) => ({ id, label, href }))).toEqual([
      { id: "deployments", label: "Deployments", href: "/deployments" },
      { id: "templates", label: "Templates", href: "/templates" },
      { id: "providers", label: "Providers", href: "/providers" },
      { id: "billing", label: "Billing", href: "/billing" },
      { id: "api_keys", label: "API Keys", href: "/user/api-keys" },
      { id: "usage", label: "Usage", href: "/usage" },
      { id: "alerts", label: "Alerts", href: "/alerts" }
    ]);
  });
});
