import type { TypedResponse } from "hono";
import { HTTPException } from "hono/http-exception";
import type { StatusCode } from "hono/utils/http-status";
import { container } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { BID_SCREENING_CONFIG } from "@src/bid-screening/providers/config.provider";
import { findRequestedGpuModels, ProviderGpuBiddingService } from "@src/bid-screening/services/provider-gpu-bidding/provider-gpu-bidding.service";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { findGpuAsks } from "@src/deployment/lib/unmet-gpu-ask/unmet-gpu-ask";
import { UnmetGpuDemandService } from "@src/deployment/services/unmet-gpu-demand/unmet-gpu-demand.service";
import type { BidScreeningResponse } from "../http-schemas/bid-screening.schema";
import { BidScreeningRequestSchema, BidScreeningResponseSchema } from "../http-schemas/bid-screening.schema";

export const bidScreeningRouter = new OpenApiHonoHandler();

/** Folds every unidentified asker into one, so anonymous asks undercount rather than count once per request. */
const ANONYMOUS_ACTOR_ID = "anonymous";

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
    const statusCode = (c.req.raw.signal.aborted ? 499 : 503) as StatusCode;
    throw new HTTPException(statusCode, { cause: error, message: "Failed to screen providers." });
  }

  const request = c.req.valid("json");
  const gpuAsks = findGpuAsks(request);

  if (!upstream.ok || !gpuAsks.length) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" }
    }) as unknown as TypedResponse<BidScreeningResponse, 200, "json">;
  }

  const screening = await upstream.json();
  await container.resolve(UnmetGpuDemandService).recordEmptyScreening(screening, {
    asks: gpuAsks,
    actorId: container.resolve(AuthService).safeCurrentUser?.id ?? c.var.clientInfo?.fingerprint ?? ANONYMOUS_ACTOR_ID,
    occurredAt: new Date()
  });

  const gpuModels = findRequestedGpuModels(request);
  const screeningWithBidding = gpuModels.length ? await container.resolve(ProviderGpuBiddingService).addBidding(screening, gpuModels) : screening;
  return c.json(screeningWithBidding as BidScreeningResponse, 200);
});
