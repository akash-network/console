import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FeatureFlagService } from "@src/services/feature-flag/feature-flag.service";
import type { FeatureFlag } from "@src/types/feature-flags";
import { UrlService } from "@src/utils/urlUtils";
import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";
import { resolveHomePath } from "./resolveHomePath";

describe(resolveHomePath.name, () => {
  it("lands a signed-in user on Projects when the intent-first onboarding is on", async () => {
    const { context, featureFlagService } = setup({ isSignedIn: true, enabledFlags: ["onboarding_intent_first"] });

    expect(await resolveHomePath(context)).toBe("/projects");
    expect(featureFlagService.isEnabledForCtx).toHaveBeenCalledWith("onboarding_intent_first", context, { userId: "user-1" });
  });

  it("keeps the Deployments list while the intent-first onboarding is off", async () => {
    const { context } = setup({ isSignedIn: true, enabledFlags: [] });

    expect(await resolveHomePath(context)).toBe("/deployments");
  });

  it("sends a signed-out visitor to the Deployments list without checking flags", async () => {
    const { context, featureFlagService } = setup({ isSignedIn: false, enabledFlags: ["onboarding_intent_first"] });

    expect(await resolveHomePath(context)).toBe("/deployments");
    expect(featureFlagService.isEnabledForCtx).not.toHaveBeenCalled();
  });

  function setup(input: { isSignedIn: boolean; enabledFlags: FeatureFlag[] }) {
    const featureFlagService = mock<FeatureFlagService>();
    featureFlagService.isEnabledForCtx.mockImplementation(async flag => input.enabledFlags.includes(flag as FeatureFlag));
    const session = { user: { id: "user-1" }, accessTokenExpiresAt: Date.now() / 1000 + 3600 };
    const context = mock<AppTypedContext>({
      getCurrentSession: vi.fn(async () => (input.isSignedIn ? session : null)) as AppTypedContext["getCurrentSession"],
      services: mock<AppTypedContext["services"]>({ urlService: UrlService, featureFlagService })
    });

    return { context, featureFlagService };
  }
});
