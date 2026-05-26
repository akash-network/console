import { describe, expect, it } from "vitest";

import { isSelfCustodyRoute, SELF_CUSTODY_ROUTES } from "./selfCustody";

describe(isSelfCustodyRoute.name, () => {
  it.each(SELF_CUSTODY_ROUTES)("returns true for self-custody route %s", route => {
    expect(isSelfCustodyRoute(route)).toBe(true);
  });

  it("ignores trailing slashes, query strings, and hash fragments", () => {
    expect(isSelfCustodyRoute("/get-started/wallet/")).toBe(true);
    expect(isSelfCustodyRoute("/get-started/wallet?ref=foo")).toBe(true);
    expect(isSelfCustodyRoute("/get-started/wallet#section")).toBe(true);
  });

  it("returns false for routes that are not gated by the self-custody flag", () => {
    expect(isSelfCustodyRoute("/")).toBe(false);
    expect(isSelfCustodyRoute("/deployments")).toBe(false);
    expect(isSelfCustodyRoute("/settings")).toBe(false);
  });
});
