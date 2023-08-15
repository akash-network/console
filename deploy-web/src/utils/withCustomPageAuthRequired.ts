import { getSession, PageRoute, withPageAuthRequired, WithPageAuthRequiredOptions } from "@auth0/nextjs-auth0";
import { ParsedUrlQuery } from "querystring";
import { UrlService } from "./urlUtils";

export function withCustomPageAuthRequired(opts: WithPageAuthRequiredOptions<{}, ParsedUrlQuery>): PageRoute<{}, ParsedUrlQuery> {
  return withPageAuthRequired({
    ...opts,
    getServerSideProps: async params => {
      const session = getSession(params.req, params.res);

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
