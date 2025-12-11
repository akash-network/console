import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";

import { Loading } from "@src/components/layout/Layout";
import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

/**
 * Dedicated login page with custom Auth0 authentication
 */
export default () => {
  const isEmbeddedLoginEnabled = useFlag("console_embedded_login");
  const searchParams = useSearchParams();
  const { urlService, windowLocation } = useServices();
  const returnUrl = searchParams.get("returnTo") || searchParams.get("from") || "/";

  useEffect(() => {
    if (!isEmbeddedLoginEnabled) {
      windowLocation.assign(searchParams.get("tab") === "signup" ? urlService.signup(returnUrl) : urlService.login(returnUrl));
    }
  }, []);

  // login page is under development
  return <Loading text="Loading..." />;
};

export const getServerSideProps = defineServerSideProps({
  route: "/login",
  schema: z.object({
    query: z.object({
      tab: z.enum(["login", "signup"]).default("login"),
      from: z.string().optional()
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
      const returnUrl = ctx.query.from;
      return {
        redirect: {
          destination: ctx.query.tab === "signup" ? ctx.services.urlService.signup(returnUrl) : ctx.services.urlService.login(returnUrl),
          permanent: false
        }
      };
    }

    return {
      props: {}
    };
  }
});
