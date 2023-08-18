import { getSession, PageRoute, withPageAuthRequired, WithPageAuthRequiredPageRouterOptions } from "@auth0/nextjs-auth0";
import { ParsedUrlQuery } from "querystring";
import { UrlService } from "./urlUtils";

export function withCustomPageAuthRequired(opts: WithPageAuthRequiredPageRouterOptions<{}, ParsedUrlQuery>): PageRoute<{}, ParsedUrlQuery> {
  return withPageAuthRequired({
    ...opts,
    getServerSideProps: async params => {
      const session = await getSession(params.req, params.res);

      const accessTokenExpiry = new Date(session.accessTokenExpiresAt * 1_000);

      if (accessTokenExpiry <= new Date()) {
        console.log(`Access token expired, redirecting to login... ${params.req.url}`);
        return {
          redirect: {
            permanent: false,
            destination: UrlService.login(params.req.url)
          }
        };
      }

      return opts.getServerSideProps(params);
    }
  });
}
