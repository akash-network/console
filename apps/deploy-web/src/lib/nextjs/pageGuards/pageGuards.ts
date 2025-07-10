import type { Redirect } from "next";

import { UrlService } from "@src/utils/urlUtils";
import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";

export async function isFeatureEnabled(featureName: string, context: AppTypedContext): Promise<boolean> {
  const session = await context.services.getSession(context.req, context.res);
  return await context.services.featureFlagService.isEnabledForCtx(featureName, context, { userId: session?.user?.id });
}

export async function isRegisteredUser(context: AppTypedContext): Promise<boolean> {
  const session = await context.services.getSession(context.req, context.res);
  return !!session?.user;
}

export async function redirectIfAccessTokenExpired(context: AppTypedContext): Promise<{ redirect: Redirect } | null> {
  const session = await context.services.getSession(context.req, context.res);
  const accessTokenExpiry = new Date((session?.accessTokenExpiresAt || 0) * 1_000);

  if (accessTokenExpiry <= new Date()) {
    context.services.logger.warn(`Access token expired, redirecting to login... ${context.req.url}`);
    return {
      redirect: {
        permanent: false,
        destination: UrlService.login(context.req.url)
      }
    };
  }

  return null;
}
