import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";

import { AuthPage } from "@src/components/auth/AuthPage/AuthPage";
import { Loading } from "@src/components/layout/Layout";
import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import type { UrlReturnToStack } from "@src/hooks/useReturnTo/UrlReturnToStack";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";
import type { UrlService } from "@src/utils/urlUtils";

export default () => {
  const isEmbeddedLoginEnabled = useFlag("console_embedded_login");
  const searchParams = useSearchParams();
  const { urlService, windowLocation, urlReturnToStack } = useServices();

  useEffect(() => {
    if (!isEmbeddedLoginEnabled) {
      const destination = getAuthRedirectDestination({
        currentLocation: windowLocation.href,
        tab: searchParams.get("tab"),
        fromSignup: searchParams.has("fromSignup"),
        services: { urlService, urlReturnToStack }
      });
      windowLocation.assign(destination);
    }
  }, [isEmbeddedLoginEnabled, windowLocation, searchParams, urlService, urlReturnToStack]);

  if (isEmbeddedLoginEnabled) {
    return <AuthPage />;
  }
  return <Loading text="Loading..." />;
};

export const getServerSideProps = defineServerSideProps({
  route: "/login",
  schema: z.object({
    query: z.object({
      tab: z.enum(["login", "signup", "forgot-password"]).default("login"),
      returnTo: z.union([z.string(), z.array(z.string())]).optional(),
      from: z.union([z.string(), z.array(z.string())]).optional()
    })
  }),
  handler: async ctx => {
    if (await isAuthenticated(ctx)) {
      return {
        redirect: {
          destination: "/",
          permanent: false
        }
      };
    }

    const isEmbeddedLoginEnabled = await isFeatureEnabled("console_embedded_login", ctx);
    if (!isEmbeddedLoginEnabled) {
      const destination = getAuthRedirectDestination({
        currentLocation: ctx.resolvedUrl,
        tab: ctx.query.tab,
        fromSignup: ctx.resolvedUrl.includes("fromSignup"),
        services: {
          urlService: ctx.services.urlService,
          urlReturnToStack: ctx.services.urlReturnToStack
        }
      });
      return { redirect: { destination, permanent: false } };
    }

    return {
      props: {}
    };
  }
});

function getAuthRedirectDestination(options: {
  currentLocation: string;
  tab: string | null;
  fromSignup?: boolean;
  services: { urlService: typeof UrlService; urlReturnToStack: typeof UrlReturnToStack };
}): string {
  if (options.tab === "signup" && !options.fromSignup) {
    return options.services.urlService.onboarding({ returnTo: "/" });
  }

  const redirectUrl = options.tab === "signup" ? options.services.urlService.signup() : options.services.urlService.login();
  const returnTo = options.services.urlReturnToStack.getReturnTo(options.currentLocation);
  const separator = redirectUrl.includes("?") ? "&" : "?";
  return `${redirectUrl}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}
