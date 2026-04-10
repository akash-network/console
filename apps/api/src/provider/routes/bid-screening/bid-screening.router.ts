import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { BidScreeningController } from "@src/provider/controllers/bid-screening/bid-screening.controller";
import { BidScreeningRequestSchema, BidScreeningResponseSchema } from "@src/provider/http-schemas/bid-screening.schema";

export const bidScreeningRouter = new OpenApiHonoHandler();

const postRoute = createRoute({
  method: "post",
  path: "/v1/bid-screening",
  summary: "Pre-filter providers by resource capacity (Stage 1 bid screening)",
  tags: ["Providers"],
  security: SECURITY_NONE,
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
      description: "Matching providers ranked by lease count and available resources",
      content: {
        "application/json": {
          schema: BidScreeningResponseSchema
        }
      }
    }
  }
});

bidScreeningRouter.openapi(postRoute, async function routeBidScreening(c) {
  const { data } = c.req.valid("json");
  const result = await container.resolve(BidScreeningController).screen(data);
  return c.json(result, 200);
});
