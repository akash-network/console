import { createProxy } from "@akashnetwork/react-query-proxy";
import type { IToggle } from "@unleash/nextjs";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Session } from "@src/lib/auth0";
import type { AppTypedContext } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { createApiSdk } from "@src/services/api-sdk/createApiSdk";
import type { FeatureFlagService } from "@src/services/feature-flag/feature-flag.service";
import type { MarketplaceVisitorReadsService } from "@src/services/marketplace-visitor-reads/marketplace-visitor-reads.service";
import { UrlService } from "@src/utils/urlUtils";

export const VISITOR_TOGGLES: IToggle[] = [
  { name: "template_marketplace", enabled: true, variant: { name: "disabled", enabled: false }, impressionData: false }
];

const ONE_HOUR_SECONDS = 60 * 60;

type Services = AppTypedContext["services"];

/** The context a marketplace page's server-side loader runs in, for a member, a visitor with no session, or a session whose token has expired. */
export function buildMarketplaceRouteContext(input: {
  session: "valid" | "expired" | "none";
  flag?: "on" | "off" | "failing";
  toggles?: IToggle[] | Error;
  query?: Record<string, string | string[]>;
  resolvedUrl?: string;
}) {
  const featureFlagService = mock<FeatureFlagService>();
  featureFlagService.isEnabledForCtx.mockImplementation(async flag => {
    if (input.flag === "failing") throw new Error("unleash down");
    return flag === "template_marketplace" && input.flag !== "off";
  });
  featureFlagService.evaluateTogglesForCtx.mockImplementation(async () => {
    if (input.toggles instanceof Error) throw input.toggles;
    if (input.toggles) return input.toggles;
    if (input.flag === "failing") throw new Error("unleash down");
    return input.flag === "off" ? VISITOR_TOGGLES.map(toggle => ({ ...toggle, enabled: false })) : VISITOR_TOGGLES;
  });
  featureFlagService.isEnabledIn.mockImplementation((name, toggles) => toggles.some(toggle => toggle.name === name && toggle.enabled));

  const nowSeconds = Math.floor(Date.now() / 1000);
  const session =
    input.session === "none"
      ? null
      : mock<Session>({
          user: { id: "user-1" },
          accessToken: "token-1",
          accessTokenExpiresAt: input.session === "valid" ? nowSeconds + ONE_HOUR_SECONDS : nowSeconds - ONE_HOUR_SECONDS
        });
  const marketplaceVisitorReads = mock<MarketplaceVisitorReadsService>();
  const logger = mock<Services["logger"]>();
  const consoleApiHttpClient = mock<Services["consoleApiHttpClient"]>();
  const template = mock<Services["template"]>();
  const res = mock<AppTypedContext["res"]>({ statusCode: 200 });
  const services = mock<Services>({
    featureFlagService,
    marketplaceVisitorReads,
    logger,
    consoleApiHttpClient,
    template,
    urlService: UrlService,
    visitorApiQueries: createProxy(createApiSdk({ baseUrl: "" })),
    apiUrlService: mock<Services["apiUrlService"]>({ getBaseApiUrlFor: vi.fn(() => "https://console-api.akash.network") }),
    privateConfig: mock<Services["privateConfig"]>({ NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID: "mainnet" })
  });
  const context = Object.assign(
    mock<AppTypedContext>({
      getCurrentSession: vi.fn<AppTypedContext["getCurrentSession"]>(async () => session),
      services,
      res,
      resolvedUrl: input.resolvedUrl ?? "/templates"
    }),
    { query: input.query ?? {} }
  );

  return { context, featureFlagService, marketplaceVisitorReads, logger, consoleApiHttpClient, template, res };
}
