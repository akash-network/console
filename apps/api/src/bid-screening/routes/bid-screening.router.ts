import type { TypedResponse } from "hono";
import { HTTPException } from "hono/http-exception";
import type { StatusCode } from "hono/utils/http-status";
import { container } from "tsyringe";

import { BID_SCREENING_CONFIG } from "@src/bid-screening/providers/config.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import type { BidScreeningRequest, BidScreeningResponse } from "../http-schemas/bid-screening.schema";
import { BidScreeningRequestSchema, BidScreeningResponseSchema } from "../http-schemas/bid-screening.schema";

export const bidScreeningRouter = new OpenApiHonoHandler();

const postBidScreeningRoute = createRoute({
  method: "post",
  operationId: "screenProviders",
  path: "/v1/bid-screening",
  summary: "Screen providers by deployment resource requirements",
  tags: ["Bid Screening"],
  security: SECURITY_NONE,
  bodyLimit: { maxSize: 64 * 1024 },
  request: {
    body: {
      content: {
        "application/json": {
          schema: BidScreeningRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns matching providers",
      content: {
        "application/json": {
          schema: BidScreeningResponseSchema
        }
      }
    },
    400: {
      description: "Invalid request body"
    }
  }
});

interface ForwardBidScreeningOptions {
  providerInventoryApiUrl: string;
  managedWalletAllowedAuditors: string[];
  fetch: typeof globalThis.fetch;
}

export function applyManagedWalletPolicy(request: BidScreeningRequest, allowedAuditors: string[]): BidScreeningRequest {
  if (allowedAuditors.length === 0) return request;

  return {
    ...request,
    requirements: {
      ...request.requirements,
      signedBy: {
        ...request.requirements.signedBy,
        anyOf: [...new Set([...request.requirements.signedBy.anyOf, ...allowedAuditors])]
      }
    }
  };
}

export async function forwardBidScreeningRequest(
  request: BidScreeningRequest,
  signal: AbortSignal,
  { providerInventoryApiUrl, managedWalletAllowedAuditors, fetch }: ForwardBidScreeningOptions
): Promise<Response> {
  const url = new URL("/v1/bid-screening", providerInventoryApiUrl);
  const normalizedRequest = applyManagedWalletPolicy(request, managedWalletAllowedAuditors);

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedRequest, (_, value) => (typeof value === "bigint" ? value.toString() : value)),
      signal
    });
  } catch (error) {
    const statusCode = (error instanceof Error && error.name === "AbortError" ? 499 : 503) as StatusCode;
    throw new HTTPException(statusCode, { cause: error, message: "Failed to screen providers." });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" }
  });
}

bidScreeningRouter.openapi(postBidScreeningRoute, async function routePostBidScreening(c) {
  const { PROVIDER_INVENTORY_API_URL } = container.resolve(BID_SCREENING_CONFIG);
  const allowedAuditors = container.resolve(BillingConfigService).get("MANAGED_WALLET_LEASE_ALLOWED_AUDITORS");
  const upstream = await forwardBidScreeningRequest(c.req.valid("json"), c.req.raw.signal, {
    providerInventoryApiUrl: PROVIDER_INVENTORY_API_URL,
    managedWalletAllowedAuditors: allowedAuditors,
    fetch: globalThis.fetch
  });

  return upstream as unknown as TypedResponse<BidScreeningResponse, 200, "json">;
});
