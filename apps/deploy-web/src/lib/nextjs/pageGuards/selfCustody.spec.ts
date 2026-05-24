import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FeatureFlagService } from "@src/services/feature-flag/feature-flag.service";
import type { FeatureFlag } from "@src/types/feature-flags";
import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";
import { isSelfCustodyEnabled, isSelfCustodyRoute, SELF_CUSTODY_ROUTES } from "./selfCustody";

describe(isSelfCustodyEnabled.name, () => {
  it("returns true when the self_custody flag is enabled in context", async () => {
    const context = setup({ enabled: true });

    expect(await isSelfCustodyEnabled(context)).toBe(true);
    expect(context.services.featureFlagService.isEnabledForCtx).toHaveBeenCalledWith("self_custody" satisfies FeatureFlag, context, expect.anything());
  });

  it("returns false when the self_custody flag is disabled in context", async () => {
    const context = setup({ enabled: false });

    expect(await isSelfCustodyEnabled(context)).toBe(false);
  });

  function setup(input: { enabled: boolean }) {
    return mock<AppTypedContext>({
      getCurrentSession: vi.fn().mockResolvedValue(null),
      services: {
        featureFlagService: mock<FeatureFlagService>({
          isEnabledForCtx: vi.fn().mockResolvedValue(input.enabled)
        })
      }
    });
  }
});

describe(isSelfCustodyRoute.name, () => {
  it.each(SELF_CUSTODY_ROUTES)("returns true for self-custody route %s", route => {
    expect(isSelfCustodyRoute(route)).toBe(true);
  });

  it("ignores trailing slashes, query strings, and hash fragments", () => {
    expect(isSelfCustodyRoute("/settings/")).toBe(true);
    expect(isSelfCustodyRoute("/settings/authorizations?ref=foo")).toBe(true);
    expect(isSelfCustodyRoute("/get-started/wallet#section")).toBe(true);
  });

  it("returns false for routes that are not gated by the self-custody flag", () => {
    expect(isSelfCustodyRoute("/")).toBe(false);
    expect(isSelfCustodyRoute("/deployments")).toBe(false);
    expect(isSelfCustodyRoute("/settings/billing")).toBe(false);
  });
});
