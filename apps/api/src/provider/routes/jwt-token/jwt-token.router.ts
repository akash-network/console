import { container } from "tsyringe";
import { z } from "zod";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { JwtTokenController } from "@src/provider/controllers/jwt-token/jwt-token.controller";
import { CreateJwtTokenRequestSchema, CreateJwtTokenResponseSchema } from "@src/provider/http-schemas/jwt-token.schema";
import { unwrapOrThrow } from "@src/utils/result";

export const providerJwtTokenRouter = new OpenApiHonoHandler();

providerJwtTokenRouter.openapi(
  createRoute({
    method: "post",
    path: "/v1/create-jwt-token",
    summary: "Create new JWT token for managed wallet",
    tags: ["JWT Token"],
    security: SECURITY_BEARER_OR_API_KEY,
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              data: CreateJwtTokenRequestSchema
            })
          }
        }
      }
    },
    responses: {
      201: {
        description: "JWT token created successfully",
        content: {
          "application/json": {
            schema: z.object({
              data: CreateJwtTokenResponseSchema
            })
          }
        }
      },
      403: {
        description:
          "With `code` `project_forbidden`, the caller is limited to some projects and the token does not name its deployments one by one, or names one filed in a project the caller cannot view, or cannot change when the token does more than read"
      }
    }
  }),
  async function routeCreateJwtToken(c) {
    const body = c.req.valid("json");
    const result = await container.resolve(JwtTokenController).createJwtToken(body.data);
    return c.json({ data: unwrapOrThrow(result) }, 201);
  }
);
