import type { Redirect } from "next";

import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";

export async function isFeatureEnabled(featureName: string, context: AppTypedContext): Promise<boolean> {
  return await context.services.featureFlagService.isEnabledForCtx(featureName, context, { userId: context.session?.user?.id });
}

export async function isAuthenticated(context: AppTypedContext): Promise<boolean> {
  return !!context.session?.user;
}

export async function redirectIfAccessTokenExpired(context: AppTypedContext): Promise<{ redirect: Redirect } | null> {
  const accessTokenExpiry = new Date((context.session?.accessTokenExpiresAt || 0) * 1_000);

  if (accessTokenExpiry <= new Date()) {
    context.services.logger.warn(`Access token expired, redirecting to login... ${context.req.url}`);
    return {
      redirect: {
        permanent: false,
        destination: context.services.urlService.newLogin({ from: context.req.url })
      }
    };
  }

  return null;
}
