import type { Context, Next } from "hono";
import { container } from "tsyringe";

import { GpuWaitlistNetworkService } from "@src/gpu-waitlist/services/gpu-waitlist-network/gpu-waitlist-network.service";

/** Delegates to the app's own not-found handler, so an instance that does not serve waitlists answers like the feature flag being off. */
export async function hideUnlessGpuWaitlistsAreServed(c: Context, next: Next) {
  if (!container.resolve(GpuWaitlistNetworkService).servesGpuWaitlists()) {
    return c.notFound();
  }

  await next();
}
