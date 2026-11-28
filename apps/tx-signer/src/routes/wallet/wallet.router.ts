import { container } from "tsyringe";

import { WalletController } from "@src/controllers/wallet/wallet.controller";
import {
  DerivedWalletAddressParamsSchema,
  DerivedWalletAddressQuerySchema,
  DerivedWalletAddressResponseSchema,
  FundingWalletAddressesResponseSchema,
  IssueProviderTokenRequestInputSchema,
  IssueProviderTokenResponseSchema
} from "@src/http-schemas/wallet.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/services/open-api-hono-handler/open-api-hono-handler";

export const walletRouter = new OpenApiHonoHandler();

const fundingWalletAddressesRoute = createRoute({
  method: "get",
  path: "/v1/wallets/funding",
  summary: "Lists the addresses of the funding wallets this signer signs with, the seed phrase one first",
  tags: ["Wallets"],
  responses: {
    200: {
      description: "Returns the funding wallet addresses",
      content: { "application/json": { schema: FundingWalletAddressesResponseSchema } }
    }
  }
});

walletRouter.openapi(fundingWalletAddressesRoute, async c => {
  return c.json(await container.resolve(WalletController).getFundingWalletAddresses(), 200);
});

const derivedWalletAddressRoute = createRoute({
  method: "get",
  path: "/v1/wallets/derived/{index}",
  summary: "Returns the address of the user wallet derived at an index",
  tags: ["Wallets"],
  request: { params: DerivedWalletAddressParamsSchema, query: DerivedWalletAddressQuerySchema },
  responses: {
    200: {
      description: "Returns the derived wallet address",
      content: { "application/json": { schema: DerivedWalletAddressResponseSchema } }
    }
  }
});

walletRouter.openapi(derivedWalletAddressRoute, async c => {
  const payload = await container.resolve(WalletController).getDerivedWalletAddress(c.req.valid("param").index, c.req.valid("query").version);
  return c.json(payload, 200);
});

const issueProviderTokenRoute = createRoute({
  method: "post",
  path: "/v1/wallets/provider-tokens",
  summary: "Issues a provider access token signed by the user wallet derived at an index",
  tags: ["Wallets"],
  request: {
    body: { content: { "application/json": { schema: IssueProviderTokenRequestInputSchema } } }
  },
  responses: {
    200: {
      description: "Returns the signed token",
      content: { "application/json": { schema: IssueProviderTokenResponseSchema } }
    }
  }
});

walletRouter.openapi(issueProviderTokenRoute, async c => {
  return c.json(await container.resolve(WalletController).issueProviderToken(c.req.valid("json")), 200);
});
