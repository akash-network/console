import { createOtelLogger } from "@akashnetwork/logging/otel";
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

const logger = createOtelLogger({ context: "BidScreening" });

const MAX_LOGGED_BODY_LENGTH = 2048;

const SCREENING_FAILED_MESSAGE = "Failed to screen providers.";

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
    },
    503: {
      description: "Provider screening is unavailable"
    }
  }
});

bidScreeningRouter.openapi(postBidScreeningRoute, async function routePostBidScreening(c) {
  const { PROVIDER_INVENTORY_API_URL } = container.resolve(BID_SCREENING_CONFIG);
  const url = new URL("/v1/bid-screening", PROVIDER_INVENTORY_API_URL);

  const payload = await c.req.text();

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal: c.req.raw.signal
    });
  } catch (error) {
    const statusCode = (c.req.raw.signal.aborted ? 499 : 503) as StatusCode;
    throw new HTTPException(statusCode, { cause: error, message: SCREENING_FAILED_MESSAGE });
  }

  if (!upstream.ok) {
    const upstreamBody = await upstream.text();
    recordUpstreamFailure({ status: upstream.status, upstreamBody, payload });

    if (upstream.status >= 500) {
      throw new HTTPException(503, { message: SCREENING_FAILED_MESSAGE });
    }

    return new Response(upstreamBody, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" }
    }) as unknown as TypedResponse<BidScreeningResponse, 200, "json">;
  }

  const request = c.req.valid("json");
  const gpuAsks = findGpuAsks(request);

  if (!gpuAsks.length) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" }
    }) as unknown as TypedResponse<BidScreeningResponse, 200, "json">;
  }

  const screening = await upstream.json();
  const userId = container.resolve(AuthService).safeCurrentUser?.id;
  if (userId) {
    await container.resolve(UnmetGpuDemandService).recordEmptyScreening(screening, { asks: gpuAsks, actorId: userId, occurredAt: new Date() });
  }

  const gpuModels = findRequestedGpuModels(request);
  const screeningWithBidding = gpuModels.length ? await container.resolve(ProviderGpuBiddingService).addBidding(screening, gpuModels) : screening;
  return c.json(screeningWithBidding as BidScreeningResponse, 200);
});

function recordUpstreamFailure({ status, upstreamBody, payload }: { status: number; upstreamBody: string; payload: string }) {
  const entry = {
    event: "BID_SCREENING_UPSTREAM_FAILED",
    status,
    upstreamBody: upstreamBody.slice(0, MAX_LOGGED_BODY_LENGTH),
    payload: payload.slice(0, MAX_LOGGED_BODY_LENGTH)
  };

  if (status >= 500) {
    logger.error(entry);
  } else {
    logger.warn(entry);
  }
}
