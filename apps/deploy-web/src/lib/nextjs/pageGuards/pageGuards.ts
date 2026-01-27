import type { Redirect } from "next";

import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";

export async function isFeatureEnabled(featureName: string, context: AppTypedContext): Promise<boolean> {
  const session = await context.getCurrentSession();
  return await context.services.featureFlagService.isEnabledForCtx(featureName, context, { userId: session?.user?.id });
}

export async function isAuthenticated(context: AppTypedContext): Promise<boolean> {
  const session = await context.getCurrentSession();
  return !!session?.user;
}

export async function redirectIfAccessTokenExpired(context: AppTypedContext): Promise<{ redirect: Redirect } | true> {
  const session = await context.getCurrentSession();
  const accessTokenExpiry = new Date((session?.accessTokenExpiresAt || 0) * 1_000);

  if (accessTokenExpiry <= new Date()) {
    context.services.logger.warn({
      event: "AUTH0_ACCESS_TOKEN_EXPIRED",
      url: context.req.url,
      message: "Access token expired, redirecting to login..."
    });
    return {
      redirect: {
        permanent: false,
        destination: context.services.urlService.newLogin({ returnTo: context.resolvedUrl })
      }
    };
  }

  return true;
}
