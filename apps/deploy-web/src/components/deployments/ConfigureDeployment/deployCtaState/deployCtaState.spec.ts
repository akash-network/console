import { describe, expect, it } from "vitest";

import type { DeployCtaInput } from "./deployCtaState";
import { deployCtaState } from "./deployCtaState";

describe(deployCtaState.name, () => {
  it.each(["configuring", "error"] as const)("asks for quotes while the spec is editable (%s)", phase => {
    expect(deployCtaState(input({ phase, quotesExpired: true }))).toBe("request-quotes");
  });

  it.each(["creating", "deploying"] as const)("shows the request in flight while %s", phase => {
    expect(deployCtaState(input({ phase, allPlacementsHaveBids: true, allPlacementsSelected: true }))).toBe("requesting");
  });

  it("keeps the request in flight while quoting until every placement has bids", () => {
    expect(deployCtaState(input({ allPlacementsHaveBids: false, allPlacementsSelected: true }))).toBe("requesting");
  });

  it("asks for a provider on every placement once all of them have bids", () => {
    expect(deployCtaState(input({ allPlacementsSelected: false }))).toBe("select-providers");
  });

  it("offers the deploy once every placement has a provider", () => {
    expect(deployCtaState(input({}))).toBe("deploy");
  });

  it("offers a retry after a failed deploy", () => {
    expect(deployCtaState(input({ hasDeployError: true }))).toBe("retry");
  });

  it("offers close and edit once the window elapsed and no open bid is left", () => {
    expect(deployCtaState(input({ quotesExpired: true, hasOpenBids: false }))).toBe("close-and-edit");
  });

  it("keeps the deploy while open bids remain after the indicative timer elapsed", () => {
    expect(deployCtaState(input({ quotesExpired: true, hasOpenBids: true }))).toBe("deploy");
  });

  it("offers close and edit for expired bids even before every placement had bids", () => {
    expect(deployCtaState(input({ allPlacementsHaveBids: false, quotesExpired: true, hasOpenBids: false }))).toBe("close-and-edit");
  });

  it("offers close and edit once the wait for a first bid ran out with none", () => {
    expect(deployCtaState(input({ allPlacementsHaveBids: false, hasOpenBids: false, noBidsReceived: true }))).toBe("close-and-edit");
  });

  it("asks for quotes after the deployment that drew no bid was closed to edit it", () => {
    expect(deployCtaState(input({ phase: "configuring", noBidsReceived: true }))).toBe("request-quotes");
  });

  function input(overrides: Partial<DeployCtaInput>): DeployCtaInput {
    return {
      phase: "quoting",
      allPlacementsHaveBids: true,
      allPlacementsSelected: true,
      hasDeployError: false,
      quotesExpired: false,
      hasOpenBids: true,
      noBidsReceived: false,
      ...overrides
    };
  }
});
