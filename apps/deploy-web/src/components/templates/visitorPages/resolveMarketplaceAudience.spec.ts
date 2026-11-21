import { describe, expect, it } from "vitest";

import { isMarketplaceEnabled, resolveMarketplaceAudience } from "./resolveMarketplaceAudience";

import { buildMarketplaceRouteContext, VISITOR_TOGGLES } from "@tests/unit/marketplaceRouteContext";

describe(resolveMarketplaceAudience.name, () => {
  it.each([
    ["on", true],
    ["off", false],
    ["failing", false]
  ] as const)("renders for a member, with the marketplace %s for them", async (flag, isEnabled) => {
    const { context, featureFlagService } = buildMarketplaceRouteContext({ session: "valid", flag });

    expect(await resolveMarketplaceAudience(context)).toEqual({ kind: "member", isMarketplaceEnabled: isEnabled });
    expect(featureFlagService.isEnabledForCtx).toHaveBeenCalledWith("template_marketplace", context, { userId: "user-1" });
    expect(featureFlagService.evaluateTogglesForCtx).not.toHaveBeenCalled();
  });

  it("renders for a visitor under the flags worked out for them, once the marketplace is on without a session", async () => {
    const { context, featureFlagService } = buildMarketplaceRouteContext({ session: "none", flag: "on" });

    expect(await resolveMarketplaceAudience(context)).toEqual({ kind: "visitor", visitorAccess: { featureToggles: VISITOR_TOGGLES } });
    expect(featureFlagService.isEnabledForCtx).toHaveBeenCalledWith("template_marketplace", context, { userId: undefined });
    expect(featureFlagService.evaluateTogglesForCtx).toHaveBeenCalledWith(context);
  });

  it.each(["off", "failing"] as const)("sends a visitor to sign in and back while the marketplace is %s for them", async flag => {
    const { context } = buildMarketplaceRouteContext({ session: "none", flag, resolvedUrl: "/template/tpl-1?utm_source=badge" });

    expect(await resolveMarketplaceAudience(context)).toEqual({
      kind: "signIn",
      redirect: { destination: "/login?tab=login&returnTo=%2Ftemplate%2Ftpl-1%3Futm_source%3Dbadge", permanent: false }
    });
  });

  it("sends a visitor to sign in when their flags cannot be worked out", async () => {
    const error = new Error("unleash down");
    const { context, logger } = buildMarketplaceRouteContext({ session: "none", flag: "on", toggles: error });

    expect(await resolveMarketplaceAudience(context)).toEqual({
      kind: "signIn",
      redirect: { destination: "/login?tab=login&returnTo=%2Ftemplates", permanent: false }
    });
    expect(logger.warn).toHaveBeenCalledWith({ event: "VISITOR_FLAGS_EVALUATION_FAILED", error });
  });

  it("sends a session whose token has expired to sign in, rather than showing it the visitor's page", async () => {
    const { context, featureFlagService } = buildMarketplaceRouteContext({ session: "expired", flag: "on" });

    expect(await resolveMarketplaceAudience(context)).toEqual({
      kind: "signIn",
      redirect: { destination: "/login?tab=login&returnTo=%2Ftemplates", permanent: false }
    });
    expect(featureFlagService.evaluateTogglesForCtx).not.toHaveBeenCalled();
  });
});

describe(isMarketplaceEnabled.name, () => {
  it("reads a flag service that is down as off, and says so in the log", async () => {
    const { context, logger } = buildMarketplaceRouteContext({ session: "valid", flag: "failing" });

    expect(await isMarketplaceEnabled(context)).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith({ event: "TEMPLATE_MARKETPLACE_FLAG_CHECK_FAILED", error: expect.objectContaining({ message: "unleash down" }) });
  });
});
