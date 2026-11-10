import { describe, expect, it } from "vitest";

import { isActiveNavLink, NAV_LINKS } from "./navLinks";

describe(isActiveNavLink.name, () => {
  it.each([
    ["/", "Dashboard"],
    ["/graph/daily-usd-spent", "Graphs"],
    ["/provider-graph/active-providers", "Graphs"],
    ["/blocks", "Blocks"],
    ["/blocks/31284786", "Blocks"],
    ["/transactions/ABC", "Transactions"],
    ["/validators", "Validators"],
    ["/validators/akashvaloper1abc", "Validators"],
    ["/bme", "BME"],
    ["/bme-graph/vault-akt", "BME"]
  ])("marks only %s's link as active", (pathname, title) => {
    expect(activeTitlesFor(pathname)).toEqual([title]);
  });

  it.each(["/addresses/akash1abc", "/graphs", "/blocksmith", "/maintenance"])("marks no link as active on %s", pathname => {
    expect(activeTitlesFor(pathname)).toEqual([]);
  });

  function activeTitlesFor(pathname: string) {
    return NAV_LINKS.filter(link => isActiveNavLink(link, pathname)).map(link => link.title);
  }
});
