import type * as unleashModule from "@unleash/nextjs";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";

import type { ServerEnvConfig } from "@src/config/env-config.schema";

export class FeatureFlagService {
  private readonly UNLEASH_COOKIE_KEY = "unleash-session-id=";

  constructor(
    private readonly unleash: typeof unleashModule,
    private readonly config: ServerEnvConfig
  ) {}

  async getFlag(name: string, sessionId?: string): Promise<boolean> {
    if (this.config.NEXT_PUBLIC_UNLEASH_ENABLE_ALL) return true;

    const definitions = await this.unleash.getDefinitions({
      fetchOptions: { next: { revalidate: 15 } }
    });

    const { toggles } = this.unleash.evaluateFlags(definitions, { sessionId });
    const flags = this.unleash.flagsClient(toggles);

    return flags.isEnabled(name);
  }

  extractSessionId(ctx: GetServerSidePropsContext): string | undefined {
    const cookies = ctx.req.headers.cookie?.split(";").map(c => c.trim());
    const unleashCookie = cookies?.find(c => c.startsWith(this.UNLEASH_COOKIE_KEY));
    return unleashCookie?.replace(this.UNLEASH_COOKIE_KEY, "");
  }

  showIfEnabled(name: string): GetServerSideProps {
    return async ctx => {
      if (this.config.NEXT_PUBLIC_UNLEASH_ENABLE_ALL) return { props: {} };

      const sessionId = this.extractSessionId(ctx);
      const isEnabled = await this.getFlag(name, sessionId);

      if (!isEnabled) return { notFound: true };

      return { props: {} };
    };
  }
}
