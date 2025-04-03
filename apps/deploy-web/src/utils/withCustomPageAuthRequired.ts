import type { PageRoute, WithPageAuthRequiredPageRouterOptions } from "@auth0/nextjs-auth0";
import { getSession, withPageAuthRequired } from "@auth0/nextjs-auth0";
import type { ParsedUrlQuery } from "querystring";

import { UrlService } from "./urlUtils";

export function withCustomPageAuthRequired(opts: WithPageAuthRequiredPageRouterOptions<object, ParsedUrlQuery>): PageRoute<object, ParsedUrlQuery> {
  return withPageAuthRequired({
    ...opts,
    getServerSideProps: async params => {
      const session = await getSession(params.req, params.res);

      const accessTokenExpiry = new Date((session?.accessTokenExpiresAt || 0) * 1_000);

      if (accessTokenExpiry <= new Date()) {
        console.log(`Access token expired, redirecting to login... ${params.req.url}`);
        return {
          redirect: {
            permanent: false,
            destination: UrlService.login(params.req.url)
          }
        };
      }

      if (opts.getServerSideProps) {
        return opts.getServerSideProps(params);
      }

      return { props: {} };
    }
  });
}
