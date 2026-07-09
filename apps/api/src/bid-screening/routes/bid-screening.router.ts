import type { TypedResponse } from "hono";
import { HTTPException } from "hono/http-exception";
import type { StatusCode } from "hono/utils/http-status";
import { container } from "tsyringe";

import { BID_SCREENING_CONFIG } from "@src/bid-screening/providers/config.provider";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import type { BidScreeningResponse } from "../http-schemas/bid-screening.schema";
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

bidScreeningRouter.openapi(postBidScreeningRoute, async function routePostBidScreening(c) {
  if (!container.resolve(FeatureFlagsService).isEnabled(FeatureFlags.ONBOARDING_REDESIGN_V1)) {
    return c.json({ providers: [] }, 200);
  }

  const { PROVIDER_INVENTORY_API_URL } = container.resolve(BID_SCREENING_CONFIG);
  const url = new URL("/v1/bid-screening", PROVIDER_INVENTORY_API_URL);

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await c.req.text(),
      signal: c.req.raw.signal
    });
  } catch (error) {
    const statusCode = (error instanceof Error && error.name === "AbortError" ? 499 : 503) as StatusCode;
    throw new HTTPException(statusCode, { cause: error, message: "Failed to screen providers." });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" }
  }) as unknown as TypedResponse<BidScreeningResponse, 200, "json">;
});
