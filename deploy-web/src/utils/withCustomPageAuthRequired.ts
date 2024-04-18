import { ParsedUrlQuery } from "querystring";
import { UrlService } from "./urlUtils";
import { GetServerSidePropsResult } from "next/types";
import { PageRoute, WithPageAuthRequired, getSession, withPageAuthRequired } from "@auth0/nextjs-auth0";

export function withCustomPageAuthRequired(...args: Parameters<WithPageAuthRequired>): PageRoute<{}, ParsedUrlQuery> {
  return withPageAuthRequired({
    ...args,
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

      return args[0].apply(params) as unknown as GetServerSidePropsResult<{}>;
    }
  });
}
