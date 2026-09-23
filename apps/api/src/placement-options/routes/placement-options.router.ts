import type { TypedResponse } from "hono";
import { HTTPException } from "hono/http-exception";
import type { StatusCode } from "hono/utils/http-status";
import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import type { PlacementOptionsResponse } from "../http-schemas/placement-options.schema";
import { PlacementOptionsResponseSchema } from "../http-schemas/placement-options.schema";
import { PLACEMENT_OPTIONS_CONFIG } from "../providers/config.provider";

export const placementOptionsRouter = new OpenApiHonoHandler();

const getPlacementOptionsRoute = createRoute({
  method: "get",
  operationId: "listPlacementOptions",
  path: "/v1/placement-options",
  summary: "List the regions and GPUs online providers can currently serve",
  tags: ["Placement Options"],
  security: SECURITY_NONE,
  cache: { maxAge: 60, staleWhileRevalidate: 300 },
  responses: {
    200: {
      description: "Returns the regions and GPUs available across online providers",
      content: {
        "application/json": {
          schema: PlacementOptionsResponseSchema
        }
      }
    }
  }
});

placementOptionsRouter.openapi(getPlacementOptionsRoute, async function routeGetPlacementOptions(c) {
  const { PROVIDER_INVENTORY_API_URL } = container.resolve(PLACEMENT_OPTIONS_CONFIG);
  const url = new URL("/v1/placement-options", PROVIDER_INVENTORY_API_URL);

  let upstream: Response;
  try {
    upstream = await fetch(url, { signal: c.req.raw.signal });
  } catch (error) {
    const statusCode = (error instanceof Error && error.name === "AbortError" ? 499 : 503) as StatusCode;
    throw new HTTPException(statusCode, { cause: error, message: "Failed to load placement options." });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" }
  }) as unknown as TypedResponse<PlacementOptionsResponse, 200, "json">;
});
