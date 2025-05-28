import type { GetSession } from "@auth0/nextjs-auth0";
import type { GetServerSideProps } from "next";

import type { FeatureFlagService } from "../feature-flag/feature-flag.service";

export class RouteProtectorService {
  constructor(
    private readonly featureFlagService: FeatureFlagService,
    private readonly getSession: GetSession
  ) {}

  showToRegisteredUserIfEnabled(name: string): GetServerSideProps {
    return async context => {
      const session = await this.getSession(context.req, context.res);
      const isEnabled = await this.featureFlagService.isEnabledForCtx(name, context);

      if (isEnabled && session?.user) {
        return {
          props: {}
        };
      }

      return { notFound: true };
    };
  }
}
