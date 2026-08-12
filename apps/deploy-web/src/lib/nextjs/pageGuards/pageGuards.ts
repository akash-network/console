import type { Redirect } from "next";

import { isAccessTokenExpired } from "@src/lib/auth0/isAccessTokenExpired/isAccessTokenExpired";
import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";

export async function isAuthenticated(context: AppTypedContext): Promise<boolean> {
  const session = await context.getCurrentSession();
  if (!session?.user) return false;

  return !isAccessTokenExpired(session);
}

export async function requireAuth(context: AppTypedContext): Promise<{ redirect: Redirect } | undefined> {
  if (await isAuthenticated(context)) return undefined;
  return {
    redirect: {
      destination: context.services.urlService.newLogin({ returnTo: context.resolvedUrl }),
      permanent: false
    }
  };
}

export async function redirectIfAccessTokenExpired(context: AppTypedContext): Promise<{ redirect: Redirect } | true> {
  const session = await context.getCurrentSession();

  if (isAccessTokenExpired(session)) {
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
