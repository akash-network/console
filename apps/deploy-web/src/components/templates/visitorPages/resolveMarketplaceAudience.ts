import type { Redirect } from "next";

import type { AppTypedContext } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";
import type { VisitorAccess } from "@src/lib/pages/visitorAccess/visitorAccess";

export type MarketplaceAudience =
  | { kind: "member"; isMarketplaceEnabled: boolean }
  | { kind: "visitor"; visitorAccess: VisitorAccess }
  | { kind: "signIn"; redirect: Redirect };

/**
 * Who a marketplace page is rendered for. A request with no session at all is a visitor once the marketplace is on for visitors;
 * until then, and for a session that has expired, it is sent to sign in as on every other page.
 */
export async function resolveMarketplaceAudience(context: AppTypedContext): Promise<MarketplaceAudience> {
  if (await isAuthenticated(context)) return { kind: "member", isMarketplaceEnabled: await isMarketplaceEnabled(context) };

  const session = await context.getCurrentSession();
  const visitorAccess = session?.user ? undefined : await openMarketplaceToVisitor(context);
  if (visitorAccess) return { kind: "visitor", visitorAccess };

  return { kind: "signIn", redirect: { destination: context.services.urlService.newLogin({ returnTo: context.resolvedUrl }), permanent: false } };
}

/** A shared template or profile link must keep working on the legacy page while the flag service is down. */
export async function isMarketplaceEnabled(context: AppTypedContext) {
  try {
    return await isFeatureEnabled("template_marketplace", context);
  } catch (error) {
    context.services.logger.warn({ event: "TEMPLATE_MARKETPLACE_FLAG_CHECK_FAILED", error });
    return false;
  }
}

async function openMarketplaceToVisitor(context: AppTypedContext): Promise<VisitorAccess | undefined> {
  if (!(await isMarketplaceEnabled(context))) return undefined;

  try {
    return { featureToggles: await context.services.featureFlagService.evaluateTogglesForCtx(context) };
  } catch (error) {
    context.services.logger.warn({ event: "VISITOR_FLAGS_EVALUATION_FAILED", error });
    return undefined;
  }
}
