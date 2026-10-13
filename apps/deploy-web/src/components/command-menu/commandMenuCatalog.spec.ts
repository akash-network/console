import { describe, expect, it } from "vitest";

import { COMMAND_PAGES, DEPLOYMENT_START_COMMANDS, goToShortcut, MENU_TOGGLE_SHORTCUT, SHOW_SHORTCUTS_SHORTCUT } from "./commandMenuCatalog";

describe("COMMAND_PAGES", () => {
  it("lists the pages the menu can open, in order, with their routes and go-to letters", () => {
    expect(COMMAND_PAGES.map(({ id, label, href, goKey }) => ({ id, label, href, goKey }))).toEqual([
      { id: "deployments", label: "Deployments", href: "/deployments", goKey: "D" },
      { id: "templates", label: "Templates", href: "/templates", goKey: "T" },
      { id: "providers", label: "Providers", href: "/providers", goKey: "R" },
      { id: "billing", label: "Billing", href: "/billing", goKey: "B" },
      { id: "api_keys", label: "API Keys", href: "/user/api-keys", goKey: "K" },
      { id: "usage", label: "Usage", href: "/usage", goKey: "U" },
      { id: "alerts", label: "Alerts", href: "/alerts", goKey: "A" }
    ]);
  });
});

describe(goToShortcut.name, () => {
  it("reaches a page with G then its letter", () => {
    expect(goToShortcut(COMMAND_PAGES[1])).toEqual({ keys: ["G", "T"], isSequence: true });
  });
});

describe("DEPLOYMENT_START_COMMANDS", () => {
  it("starts each kind of deployment from its own key", () => {
    expect(DEPLOYMENT_START_COMMANDS.map(({ kind, action, label, keywords, shortcut }) => ({ kind, action, label, keywords, shortcut }))).toEqual([
      { kind: "new-deployment", action: "new_deployment", label: "New deployment", keywords: "create deploy launch", shortcut: { keys: ["N"] } },
      {
        kind: "container",
        action: "new_container",
        label: "New container",
        keywords: "docker image byo bring your own container deploy configure",
        shortcut: { keys: ["shift", "C"] }
      },
      {
        kind: "linux",
        action: "new_linux_machine",
        label: "New Linux machine",
        keywords: "ssh ubuntu debian centos suse vm server linux deploy configure",
        shortcut: { keys: ["shift", "L"] }
      }
    ]);
  });
});

describe("fixed shortcuts", () => {
  it("opens the menu with the platform modifier and K, and the shortcuts sheet with ?", () => {
    expect(MENU_TOGGLE_SHORTCUT).toEqual({ keys: ["mod", "K"] });
    expect(SHOW_SHORTCUTS_SHORTCUT).toEqual({ keys: ["?"] });
  });
});
