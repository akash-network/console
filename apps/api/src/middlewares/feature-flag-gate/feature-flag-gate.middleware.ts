import type { Context, Next } from "hono";
import { container } from "tsyringe";

import type { FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";

/** Delegates to the app's own not-found handler, so a route the flag hides answers exactly like a path that does not exist. */
export const requireFeatureFlag = (featureFlag: FeatureFlagValue) =>
  async function hideUnlessFeatureFlagIsOn(c: Context, next: Next) {
    if (!container.resolve(FeatureFlagsService).isEnabled(featureFlag)) {
      return c.notFound();
    }

    await next();
  };
