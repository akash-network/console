import type { GetSession } from "@auth0/nextjs-auth0";
import type { GetServerSideProps } from "next";
import type { GetServerSidePropsResult } from "next/types";

import type { FeatureFlagService } from "../feature-flag/feature-flag.service";

const NOT_FOUND: GetServerSidePropsResult<any> = {
  notFound: true
};

export class RouteProtectorService {
  constructor(
    private readonly featureFlagService: FeatureFlagService,
    private readonly getSession: GetSession
  ) {}

  showToRegisteredUserIfEnabled(name: string): GetServerSideProps {
    return async context => {
      const session = await this.getSession(context.req, context.res);

      if (!session?.user) {
        return NOT_FOUND;
      }

      const isEnabled = await this.featureFlagService.isEnabledForCtx(name, context, { userId: session.user.id });

      if (isEnabled) {
        return {
          props: {}
        };
      }

      return NOT_FOUND;
    };
  }
}
